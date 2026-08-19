import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const SocialMediaCampaigns: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What types of social media campaigns can I run on SmartExn?',
      a: 'Advertisers can launch campaigns for authentic social engagement across YouTube, X (Twitter), Instagram, TikTok, Facebook, LinkedIn, Discord, and Telegram—including channel subscriptions, post shares, meaningful comments, and group joins.'
    },
    {
      q: 'How does SmartExn prevent bot or fake engagement?',
      a: 'SmartExn employs multi-layer verification: workers must submit uncropped visual proof and registered handles, and all submissions are subject to advertiser review before escrow release. Suspicious activity triggers automated bot-filter flags.'
    },
    {
      q: 'How does campaign budget and escrow work for advertisers?',
      a: 'When you create a campaign, you specify the target completion count and reward per worker. 100% of the funds are held securely in platform escrow and disbursed only when you approve submitted proof.'
    },
    {
      q: 'Can I target specific geographic regions for my social campaign?',
      a: 'Yes. SmartExn provides granular geographic and demographic targeting options so your campaigns reach the exact audience relevant to your brand.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/advertise/social-media-campaigns#webpage",
        "url": "https://smartexn.com/advertise/social-media-campaigns",
        "name": "Social Media Marketing Campaigns: Crowdsourced Engagement | SmartExn",
        "description": "Deploy targeted crowdsourced social media engagement campaigns on SmartExn. Drive authentic community growth, brand reach, and verified social interactions.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/advertise/social-media-campaigns#breadcrumb",
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
            "name": "For Advertisers",
            "item": "https://smartexn.com/advertise"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Social Media Campaigns",
            "item": "https://smartexn.com/advertise/social-media-campaigns"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/advertise/social-media-campaigns#faq",
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
        title="Social Media Marketing Campaigns: Crowdsourced Engagement | SmartExn"
        description="Deploy targeted crowdsourced social media engagement campaigns on SmartExn. Drive authentic community growth, brand reach, and verified social interactions."
        canonicalUrl="https://smartexn.com/advertise/social-media-campaigns"
        schema={schemaData}
      />
      <PublicNavHeader activePage="advertise" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/advertise" className="hover:text-sky-400 transition-colors">For Advertisers</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Social Media Campaigns</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/50 text-xs font-semibold text-sky-400">
            <span>Advertiser Authority</span>
            <span>•</span>
            <span>4 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Crowdsourced Social Media Campaigns: Authentic Reach & Verified Interactions
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Scale your brand's digital presence with verified, human-driven social interactions across major platforms with 100% escrow protection and manual proof review.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Brands Choose SmartExn for Social Reach
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Automated bot farms and synthetic click networks risk account suspensions and algorithmic penalties. SmartExn connects brands directly with thousands of real, authenticated human users who interact naturally with your content.
          </p>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Whether you are launching a new YouTube channel, building an active Discord community, or announcing a product release on X (Twitter), crowdsourced micro-tasks deliver measurable engagement.
          </p>
        </section>

        {/* Campaign Types */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. Supported Social Media Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Followers & Subscriptions</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Grow verified subscriber bases across YouTube, TikTok, Instagram, Twitter, and Twitch.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Community & Server Growth</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Attract genuine members to Telegram announcement channels, Discord servers, and Reddit communities.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Post Engagement & Retweets</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Amplify product announcements with verified shares, retweets, likes, and thoughtful comments.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">Video Watch Time & Feedback</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Encourage full-length video viewings and constructive comments to signal strong algorithmic retention.
              </p>
            </div>
          </div>
        </section>

        {/* Advertiser Controls */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Advertiser Controls & Quality Assurance
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm sm:text-base">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Granular Targeting:</strong> Select target countries, languages, and device operating systems for every campaign.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Proof Verification Dashboard:</strong> Inspect submitted screenshots and profile handles before approving payment.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>100% Escrow Protection:</strong> You only pay for verified completions that meet your exact campaign criteria.</span>
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
            <Link to="/advertise/app-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Launching Mobile App Testing Campaigns
            </Link>
            <Link to="/advertise/website-testing-campaigns" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Website UX & Traffic Testing Campaigns
            </Link>
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/advertise" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Complete Advertiser Portal Overview
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Launch Your Social Campaign Today</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Reach thousands of authenticated human contributors and grow your community with verified proof.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/advertise"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Create Campaign
            </Link>
            <Link
              to="/campaigns"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              View Active Campaigns
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
