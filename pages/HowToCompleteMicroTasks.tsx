import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const HowToCompleteMicroTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How long do advertisers take to review submitted tasks?',
      a: 'Advertisers typically review proofs within 24 to 72 hours. If an advertiser does not take action within the platform review deadline, eligible tasks are automatically approved and credited.'
    },
    {
      q: 'Can I complete the same task multiple times?',
      a: 'Unless explicitly stated in the campaign instructions as a repeatable task, each micro-task campaign permits only one submission per worker account.'
    },
    {
      q: 'Where do my earnings go once approved?',
      a: 'Approved rewards are released directly from the campaign escrow into your Task Earnings wallet balance.'
    },
    {
      q: 'What should I do if a task has expired before I submit proof?',
      a: 'If the campaign runs out of slots or your reservation timer expires, you cannot submit proof. Always ensure you complete and submit your proof promptly.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks#article",
        "headline": "How to Complete Micro-Tasks Successfully",
        "description": "Step-by-step educational guide on finding tasks, reading criteria, submitting valid proof, and earning rewards on SmartExn.",
        "inLanguage": "en-US",
        "mainEntityOfPage": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks",
        "publisher": {
          "@type": "Organization",
          "@id": "https://smartexn.com/#organization",
          "name": "SmartExn",
          "url": "https://smartexn.com"
        }
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks#howto",
        "name": "How to Complete Micro-Tasks Successfully on SmartExn",
        "description": "Step-by-step walkthrough to discover available tasks, follow advertiser criteria, collect valid proof, and receive approved earnings.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Find an Available Task",
            "text": "Browse the task catalog and check slot quotas and device compatibility."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Read the Requirements",
            "text": "Review the specific instructions, prohibited behaviors, and required evidence type."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Complete Every Required Action",
            "text": "Perform the requested actions in real time without shortcuts or automated scripts."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Collect Valid Proof",
            "text": "Capture clear, uncropped screenshots or required profile identifiers."
          },
          {
            "@type": "HowToStep",
            "position": 5,
            "name": "Submit Proof & Wait for Review",
            "text": "Submit evidence through the portal and wait for creator approval or automated escrow release."
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks#webpage",
        "url": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks",
        "name": "How to Complete Micro-Tasks Successfully | SmartExn Knowledge Base",
        "description": "Step-by-step educational guide on finding tasks, reading criteria, submitting valid proof, and earning rewards on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks#breadcrumb",
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
            "name": "How to Complete Micro-Tasks Successfully",
            "item": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/how-to-complete-micro-tasks#faq",
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
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="How to Complete Micro-Tasks Successfully | SmartExn Guide"
        description="Step-by-step educational guide on how online micro-tasks work, reading requirements, collecting valid proof, and receiving approved escrow rewards."
        canonical="https://smartexn.com/knowledge-base/how-to-complete-micro-tasks"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="knowledge-base" />

      <main className="flex-1">
        {/* Article Header */}
        <section className="py-12 sm:py-16 border-b border-sky-500/10 bg-gradient-to-b from-[#091e38] to-[#061325]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            
            {/* Visible Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link to="/knowledge-base" className="hover:text-white transition-colors">Knowledge Base</Link>
              <span>/</span>
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">How to Complete Micro-Tasks</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase">
                Worker Guide
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 4 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              How to Complete Micro-Tasks Successfully
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              A comprehensive walkthrough for remote earners: discover available jobs, follow campaign criteria, capture accurate verification proof, and avoid common rejection pitfalls.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              What Are Micro-Tasks?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Micro-tasks are bite-sized digital activities published by businesses, content creators, and researchers. Unlike long-term freelance contracts, micro-tasks are discrete assignments designed to be completed in a few minutes. Typical examples include testing user flows on a website, following a verified social page, providing qualitative feedback on a mobile application, or categorizing dataset elements.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              On SmartExn, every micro-task campaign is funded upfront by the advertiser. Funds are held in platform escrow until worker submissions are reviewed and verified, ensuring worker protection.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              How to Find an Available Task
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Once registered as a SmartExn member, visit the Member Dashboard or explore the public{' '}
              <Link to="/micro-tasks" className="text-sky-400 hover:underline font-semibold">Micro-Tasks Catalog</Link>.
              Tasks are organized by category, required time estimate, target region, and reward per completed slot.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm sm:text-base pl-2">
              <li><strong>Check Slot Availability:</strong> Each campaign has a limited quota of slots. If a campaign displays 0 available slots, new submissions are closed.</li>
              <li><strong>Verify Eligibility:</strong> Ensure your device type (mobile, desktop, tablet) and geographic location match the campaign specifications.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Read the Requirements Before Starting
            </h2>
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-sm space-y-2">
              <span className="font-bold flex items-center gap-2 text-amber-300">
                <span>⚠️</span> Crucial Step: Never Skip the Instructions
              </span>
              <p className="text-xs sm:text-sm">
                Advertisers set precise conditions for what constitutes an acceptable submission. Skipping a step—such as not staying on a page for the required duration or not including a specific confirmation code—will result in your proof being rejected.
              </p>
            </div>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Always review:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-sm sm:text-base pl-2">
              <li>The exact sequence of actions requested (e.g., download app, create account, reach level 2).</li>
              <li>The required proof type (screenshot, username, profile link, transaction ID, or confirmation text).</li>
              <li>Any prohibited behavior (e.g., use of automated bots, VPNs, or burner accounts).</li>
            </ol>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Complete Every Required Action
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Execute each step accurately in real time. Do not attempt shortcuts or automate actions. Advertisers utilize manual audits, server timestamps, and digital matching to ensure genuine user participation.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Collect Valid Proof
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Proof is the sole mechanism the advertiser uses to confirm your completion. For full technical details on formatting, read our dedicated{' '}
              <Link to="/knowledge-base/task-proof-guide" className="text-sky-400 hover:underline font-semibold">Task Proof Guide</Link>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-bold text-sm">✓ High-Quality Proof</span>
                <ul className="text-xs text-slate-300 space-y-1">
                  <li>• Clear, uncropped screenshots showing status</li>
                  <li>• Exact username matching your public profile</li>
                  <li>• Full destination URL copied directly from address bar</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-rose-400 font-bold text-sm">✗ Invalid Proof</span>
                <ul className="text-xs text-slate-300 space-y-1">
                  <li>• Blurry, dark, or unreadable screenshots</li>
                  <li>• Cropped images omitting timestamps or handles</li>
                  <li>• Reused proofs submitted to other campaigns</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Submit Your Proof & Wait for Review
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Input your text details and attach your image files in the task submission form on your dashboard. Once submitted:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-sm sm:text-base pl-2">
              <li>The task enters <strong>Pending Review</strong> status.</li>
              <li>The advertiser is allocated a designated window (typically 24–72 hours) to verify the submission.</li>
              <li>Upon approval, the reward is released from escrow and credited to your <strong>Task Earnings</strong> balance.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              What Happens if a Task Is Rejected?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              If an advertiser finds that your submission does not satisfy their requirements, they will mark it as rejected along with an explanation. To understand why rejections occur, read{' '}
              <Link to="/knowledge-base/why-tasks-get-rejected" className="text-sky-400 hover:underline font-semibold">Why Micro-Task Submissions Get Rejected</Link>.
            </p>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              If you believe a rejection was unjustified, SmartExn provides a structured{' '}
              <Link to="/trust-and-safety" className="text-sky-400 hover:underline font-semibold">Dispute Resolution Process</Link>{' '}
              where our moderation team can examine the submitted evidence.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              Tips for Better Task Submissions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/40 space-y-2">
                <span className="font-bold text-sky-300 text-sm">1. Focus on Accuracy</span>
                <p className="text-slate-300">Taking 30 extra seconds to double-check usernames and links prevents rejections and keeps your worker reputation high.</p>
              </div>
              <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/40 space-y-2">
                <span className="font-bold text-sky-300 text-sm">2. Use Real Accounts</span>
                <p className="text-slate-300">Authentic social accounts with activity history are accepted reliably by automated and human reviewers alike.</p>
              </div>
              <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/40 space-y-2">
                <span className="font-bold text-sky-300 text-sm">3. Submit Promptly</span>
                <p className="text-slate-300">Complete tasks immediately after reserving to avoid reservation timer expirations.</p>
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

          {/* Related Guides Component */}
          <section className="pt-8 border-t border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Related Guides & Documentation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                to="/knowledge-base/task-proof-guide"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Task Proof Guide →</span>
                <p className="text-xs text-slate-300">Master screenshot rules and handle verification.</p>
              </Link>
              <Link
                to="/knowledge-base/why-tasks-get-rejected"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Why Tasks Get Rejected →</span>
                <p className="text-xs text-slate-300">Avoid common mistakes that lead to rejection.</p>
              </Link>
              <Link
                to="/how-it-works-for-workers"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Worker Workflow Guide →</span>
                <p className="text-xs text-slate-300">Complete overview of escrow payments and balances.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default HowToCompleteMicroTasks;
