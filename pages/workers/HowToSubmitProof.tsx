import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const HowToSubmitProof: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What formats are accepted for screenshot proof?',
      a: 'SmartExn accepts standard PNG, JPG, and JPEG image formats. Ensure your screenshot is uncompressed, uncropped, and legible.'
    },
    {
      q: 'What if a task asks for text proof instead of a screenshot?',
      a: 'Enter the exact requested information—such as your account username, confirmation link, or reference code—directly into the provided text proof input field.'
    },
    {
      q: 'Can I upload multiple screenshots for a single task?',
      a: 'If a campaign requires multiple verification milestones, the submission form will provide multiple upload slots or allow combined proof attachments.'
    },
    {
      q: 'How do I know if my proof was successfully received?',
      a: 'Once submitted, the task status changes to "Under Review" in your worker dashboard, and a countdown timer for advertiser review will begin.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://smartexn.com/workers/how-to-submit-proof#article",
        "headline": "How to Submit Valid Task Proof on SmartExn",
        "description": "Step-by-step worker guide for capturing and submitting valid screenshots, handles, and URLs to ensure fast task approval on SmartExn.",
        "inLanguage": "en-US",
        "mainEntityOfPage": "https://smartexn.com/workers/how-to-submit-proof",
        "publisher": {
          "@type": "Organization",
          "@id": "https://smartexn.com/#organization",
          "name": "SmartExn",
          "url": "https://smartexn.com"
        }
      },
      {
        "@type": "HowTo",
        "@id": "https://smartexn.com/workers/how-to-submit-proof#howto",
        "name": "How to Submit Valid Task Proof",
        "description": "Step-by-step workflow for capturing and uploading authentic verification proof for micro-tasks.",
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Review Proof Instructions",
            "text": "Inspect the requested proof format (full-screen screenshot, handle, or confirmation URL)."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Capture Uncropped Evidence",
            "text": "Take a high-resolution screenshot displaying the required interface with status timestamp."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "Fill in Text Identifiers",
            "text": "Type your exact matching username or transaction reference code in the form."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Submit Before Timer Expiry",
            "text": "Upload the files and click submit to trigger advertiser escrow review."
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/how-to-submit-proof#webpage",
        "url": "https://smartexn.com/workers/how-to-submit-proof",
        "name": "How to Submit Valid Task Proof on SmartExn | Worker Guidelines",
        "description": "Step-by-step worker guide for capturing and submitting valid screenshots, handles, and URLs to ensure fast task approval on SmartExn.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/how-to-submit-proof#breadcrumb",
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
            "name": "How to Submit Proof",
            "item": "https://smartexn.com/workers/how-to-submit-proof"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/how-to-submit-proof#faq",
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
        title="How to Submit Valid Task Proof on SmartExn | Worker Guidelines"
        description="Step-by-step worker guide for capturing and submitting valid screenshots, handles, and URLs to ensure fast task approval on SmartExn."
        canonicalUrl="https://smartexn.com/workers/how-to-submit-proof"
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
          <span className="text-sky-400 font-medium">How to Submit Proof</span>
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
            How to Submit Valid Task Proof: Screenshots, Handles & URLs
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Learn the exact requirements for capturing uncropped screenshot evidence, entering matching account handles, and avoiding common proof submission errors.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Clean Proof Matters
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            When you complete a task on SmartExn, the advertiser must verify that the requested action was performed correctly before approving payment from escrow. Clear, unambiguous proof enables advertisers to approve your submission in seconds without raising disputes.
          </p>
        </section>

        {/* 4 Steps */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Steps to Perfect Proof Submission
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Capture the Completed State</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Take a screenshot showing the final success screen, active "Following" button, or completed registration page.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Include Your Identifier</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Ensure the screenshot displays your username, avatar, or device timestamp to prove the screenshot is uniquely yours.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Provide Exact Text Data</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Type your exact username, email handle, or reference code into the text fields without typos.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Submit Before Countdown Ends</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Click Submit Proof before your slot reservation timer expires to lock in your submission.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Common Mistakes to Avoid
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Cropping the image:</strong> Do not crop out the browser URL bar or smartphone notification bar; advertisers look for contextual indicators.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Submitting blurry photos of screens:</strong> Use built-in system screenshot shortcuts rather than photographing a computer monitor with a phone.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Double-check handle spelling:</strong> Mismatched usernames between the text field and the screenshot are the #1 cause of accidental rejections.</span>
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
            <Link to="/task-proof" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Visual Task Proof Requirements & Examples
            </Link>
            <Link to="/workers/how-to-avoid-task-rejection" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → How to Avoid Task Rejections on SmartExn
            </Link>
            <Link to="/trust-and-safety/disputes" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Two-Tier Dispute Resolution & Arbitration Desk
            </Link>
            <Link to="/micro-tasks" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Browse Live Micro-Tasks Catalog
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Ready to Submit Verified Work?</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse currently active micro-tasks and earn escrow-backed rewards on SmartExn today.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Tasks
            </Link>
            <Link
              to="/task-proof"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Visual Proof Guide
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
