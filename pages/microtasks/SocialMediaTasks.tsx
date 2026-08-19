import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SocialMediaTasks: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What are social media micro-tasks on SmartExn?',
      a: 'Social media micro-tasks involve engaging with digital content created by independent advertisers. Typical tasks include following official social profiles, subscribing to channels, liking publications, watching videos, or sharing content to help businesses increase reach.'
    },
    {
      q: 'What proof is required for social media tasks?',
      a: 'Proof usually consists of your exact social media username/handle used during the task and an uncropped screenshot showing the completed action (such as the "Following", "Subscribed", or "Liked" button active).'
    },
    {
      q: 'Why do social media task submissions get rejected?',
      a: 'The most common reasons are unfollowing/unsubscribing immediately after submission, submitting private or unidentifiable handles, uploading blurry or outdated screenshots, or failing to meet account maturity requirements specified by the advertiser.'
    },
    {
      q: 'Are social media tasks available at all times?',
      a: 'Task availability depends on active advertiser campaign budgets and slot allocations. Because slots are limited and distributed on a first-come, first-served basis, available tasks fluctuate throughout the day.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/micro-tasks/social-media-tasks#webpage",
        "url": "https://smartexn.com/micro-tasks/social-media-tasks",
        "name": "Social Media Micro-Tasks: Engagement, Subscriptions & Proof Guidelines | SmartExn",
        "description": "Learn how social media micro-tasks work on SmartExn. Understand requirements for channel follows, video views, likes, valid proof submission, and avoiding rejection.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/micro-tasks/social-media-tasks#breadcrumb",
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
            "name": "Micro-Tasks",
            "item": "https://smartexn.com/micro-tasks"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Social Media Tasks",
            "item": "https://smartexn.com/micro-tasks/social-media-tasks"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/micro-tasks/social-media-tasks#faq",
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
        title="Social Media Micro-Tasks: Engagement, Subscriptions & Proof Guidelines | SmartExn"
        description="Learn how social media micro-tasks work on SmartExn. Understand requirements for channel follows, video views, likes, valid proof submission, and avoiding rejection."
        canonicalUrl="https://smartexn.com/micro-tasks/social-media-tasks"
        schema={schemaData}
      />
      <PublicNavHeader activePage="micro-tasks" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/micro-tasks" className="hover:text-sky-400 transition-colors">Micro-Tasks</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Social Media Tasks</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {/* Hero Section */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Micro-Task Authority</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Social Media Micro-Tasks: Engagement, Follows & Proof Guidelines
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            A comprehensive guide to understanding social engagement campaigns on SmartExn, including channel follows, content sharing, verification standards, and best practices to prevent task rejection.
          </p>
        </header>

        {/* Section 1: Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. What Are Social Media Micro-Tasks?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Content creators, digital publishers, and small businesses frequently launch crowdsourced promotional campaigns on SmartExn to amplify their organic reach. These advertisers specify clear actions—such as following an Instagram account, subscribing to a YouTube channel, liking a Facebook post, or joining a Telegram group.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Every social media task is backed by upfront funds locked in SmartExn escrow. When you perform the requested interaction, submit verifiable proof, and obtain advertiser or automated approval, your task earnings are credited directly to your balance.
          </p>
        </section>

        {/* Section 2: Typical Workflow */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Step-by-Step Task Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="text-base font-semibold text-white">Read All Instructions</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Check whether the advertiser requires a specific platform version, minimum profile age, or specific comment format before starting.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="text-base font-semibold text-white">Execute the Social Action</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Open the advertiser's official destination link and perform the requested interaction (e.g., Click Follow or Subscribe).
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="text-base font-semibold text-white">Capture Clean Proof</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Take an unedited screenshot clearly showing your active follow state, timestamp, and account handle.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-sm">
                4
              </div>
              <h3 className="text-base font-semibold text-white">Submit Proof & Review</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Submit the required text and screenshot before the slot reservation timer expires. Advertisers review within 24 to 72 hours.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Proof Requirements & Pitfalls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Essential Proof Requirements & Avoiding Rejection
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Provide exact username/handle:</strong> Ensure the handle you enter in the text proof field matches the profile visible in your screenshot.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Maintain active status:</strong> Do not unfollow or delete interactions post-submission. Advertisers conduct routine audits and may flag accounts that immediately retract actions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-rose-400 font-bold">✗</span>
              <span><strong>Avoid cropped or generic screenshots:</strong> Full-screen captures showing platform context and device status bar are significantly more likely to be approved.</span>
            </li>
          </ul>
        </section>

        {/* Section 4: Transparency & Realistic Availability */}
        <section className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-amber-300">
            Availability & Reward Disclaimers
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Task availability is strictly variable and governed by advertiser budgets. SmartExn does not promise guaranteed task volume or fixed income. Earnings depend entirely on your completion speed, proof accuracy, and advertiser campaign requirements.
          </p>
        </section>

        {/* Section 5: FAQs */}
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

        {/* Contextual Links / Related Guides */}
        <section className="border-t border-slate-800 pt-8 space-y-4">
          <h3 className="text-base font-bold text-white">Related Guides & Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <Link to="/knowledge-base/task-proof-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Task Proof Guide: How to Submit Valid Proof
            </Link>
            <Link to="/knowledge-base/why-tasks-get-rejected" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Why Micro-Task Submissions Get Rejected
            </Link>
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → SmartExn 100% Upfront Escrow Protection
            </Link>
            <Link to="/micro-tasks/app-testing" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → App Testing Tasks & Guidelines
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Ready to Explore Active Micro-Tasks?</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Browse our live micro-task catalog to see currently available campaigns from verified advertisers.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/micro-tasks"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Browse Micro-Tasks
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Create Free Account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
