import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';

export const KnowledgeTaskProof: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Can I upload an edited or marked-up screenshot?',
      a: 'Minor annotations (such as highlighting a confirmation number) are acceptable, but you must never crop out essential timestamps, status indicators, or account handles.'
    },
    {
      q: 'What if an advertiser requests a proof type I cannot provide?',
      a: 'Always read the campaign requirements prior to accepting a task. If a task demands proof you cannot safely or accurately provide, do not accept the task.'
    },
    {
      q: 'Are file uploads secure on SmartExn?',
      a: 'Yes. Proof submissions are stored securely and only accessible to the campaign advertiser and authorized dispute arbitrators.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base/task-proof-guide#webpage",
        "url": "https://smartexn.com/knowledge-base/task-proof-guide",
        "name": "Task Proof Guide: How to Submit Valid Proof | SmartExn Knowledge Base",
        "description": "Technical instructions on submitting screenshots, usernames, URLs, and confirmation codes for online task verification.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base/task-proof-guide#breadcrumb",
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
            "name": "Task Proof Guide: How to Submit Valid Proof",
            "item": "https://smartexn.com/knowledge-base/task-proof-guide"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/knowledge-base/task-proof-guide#faq",
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
        title="Task Proof Guide: How to Submit Valid Proof | SmartExn"
        description="Comprehensive guide on submitting valid screenshots, profile handles, URLs, and confirmation codes for micro-task verification."
        canonical="https://smartexn.com/knowledge-base/task-proof-guide"
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
              <span className="text-slate-300 truncate max-w-xs sm:max-w-md">Task Proof Guide</span>
            </nav>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold uppercase">
                Proof Verification
              </span>
              <span className="text-xs text-slate-400">Updated August 2026</span>
              <span className="text-xs text-slate-400">• 5 min read</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Task Proof Guide: How to Submit Valid Proof
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Everything you need to know about preparing clear, verifiable proof of task completion. Learn best practices for screenshots, usernames, URLs, reference codes, and timestamps.
            </p>
          </div>
        </section>

        {/* Content Body */}
        <article className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Introductory Notice */}
          <div className="p-4 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sm text-slate-300 space-y-2">
            <span className="font-bold text-white flex items-center gap-2">
              <span>📋</span> Campaign-Specific Proof Rules
            </span>
            <p>
              Every campaign is configured independently by the advertiser. While some campaigns require an image screenshot, others may ask only for a public profile username or a specific order confirmation ID. For our visual screenshot rules, also review the official{' '}
              <Link to="/task-proof" className="text-sky-400 font-semibold hover:underline">Visual Task Proof Guide</Link>.
            </p>
          </div>

          {/* Section 1: Screenshots */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              1. Capturing and Submitting Screenshots
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Screenshots are the most common form of verification. To guarantee that an advertiser can validate your work without ambiguity:
            </p>
            <div className="space-y-3 pl-2">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-300">
                <strong className="text-white block mb-1">Capture the Full Screen:</strong>
                Include relevant context such as the application header, date/time in the notification bar, or status confirmation box. Do not crop tightly around a single icon.
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-300">
                <strong className="text-white block mb-1">High Resolution & Readability:</strong>
                Ensure the image is sharp and text is legible. Compressed, blurry, or low-contrast images are liable to rejection.
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-300">
                <strong className="text-white block mb-1">Standard File Formats:</strong>
                Submit images in standard formats (PNG, JPG, JPEG, WEBP) under the maximum allowable upload size.
              </div>
            </div>
          </section>

          {/* Section 2: Usernames & Social Handles */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              2. Usernames & Profile Handles
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              When a campaign asks for your username (e.g. on YouTube, X, GitHub, or Instagram):
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm sm:text-base pl-2">
              <li><strong>Provide the exact handle:</strong> Include the @ symbol if requested (e.g., <code className="text-sky-300 font-mono">@johndoe_user</code>).</li>
              <li><strong>Public Visibility:</strong> Ensure the profile or activity you performed is publicly viewable so the advertiser can confirm it in their subscriber or follower log.</li>
              <li><strong>Mismatched Account Risk:</strong> If your submitted handle does not match the account shown in your screenshot, the advertiser cannot verify your identity.</li>
            </ul>
          </section>

          {/* Section 3: URLs & Destination Links */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              3. URLs & Destination Links
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              For tasks involving content sharing, comments, or article publishing, advertisers often request the exact permalink.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm sm:text-base pl-2">
              <li>Copy the direct permalink to your comment or post, not just the homepage of the website.</li>
              <li>Test the link in an incognito or private browsing tab to ensure it is publicly accessible without login walls.</li>
            </ul>
          </section>

          {/* Section 4: Reference IDs & Confirmation Codes */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              4. Reference IDs, Order Codes & Text Answers
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Certain campaigns provide a completion code at the end of a multi-step survey or registration funnel. Always copy this alphanumeric string accurately into the text response field.
            </p>
          </section>

          {/* Section 5: Common Invalidation Errors */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight border-l-4 border-sky-500 pl-4">
              5. Pitfalls That Invalidate Proof
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                <span className="text-rose-300 font-bold text-sm">Duplicate Submissions</span>
                <p className="text-xs text-slate-300">
                  Submitting the same screenshot or transaction code across multiple tasks or accounts will lead to immediate rejection and account suspension under our{' '}
                  <Link to="/terms-of-use" className="text-rose-400 underline">Terms of Use</Link>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                <span className="text-rose-300 font-bold text-sm">Mismatched Account Info</span>
                <p className="text-xs text-slate-300">
                  Submitting proof belonging to a third party or a mismatched username makes it impossible for advertisers to credit you.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="space-y-6 pt-4 border-t border-slate-800">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Frequently Asked Questions About Task Proof
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
                to="/task-proof"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Visual Proof Guide →</span>
                <p className="text-xs text-slate-300">See good vs bad screenshot examples.</p>
              </Link>
              <Link
                to="/knowledge-base/why-tasks-get-rejected"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Why Tasks Get Rejected →</span>
                <p className="text-xs text-slate-300">Understand rejection criteria and review rules.</p>
              </Link>
              <Link
                to="/faqs"
                className="p-4 rounded-xl bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400 transition-colors space-y-1 block group"
              >
                <span className="text-xs font-bold text-sky-400 group-hover:text-sky-300">Knowledge Base FAQs →</span>
                <p className="text-xs text-slate-300">Search questions on tasks, accounts, and payments.</p>
              </Link>
            </div>
          </section>

        </article>
      </main>

      <PublicFooter />
    </div>
  );
};

export default KnowledgeTaskProof;
