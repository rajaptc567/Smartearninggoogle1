import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const WorkerAccountSecurity: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Does SmartExn support Two-Factor Authentication (2FA)?',
      a: 'Yes. SmartExn supports Two-Factor Authentication (2FA) via time-based one-time password (TOTP) authenticator apps to safeguard your account and wallet balances.'
    },
    {
      q: 'Will SmartExn staff ever ask for my password or private recovery phrases?',
      a: 'No. Official SmartExn support staff will never ask for your account password, 2FA codes, or private credentials under any circumstances.'
    },
    {
      q: 'Can I log into my account from multiple devices?',
      a: 'Yes, you may log in from your mobile phone and desktop computer. However, sharing your account credentials with other individuals or using automated multi-accounting scripts is strictly prohibited.'
    },
    {
      q: 'What should I do if I notice unrecognized account activity?',
      a: 'Immediately change your password, review your active login sessions in Account Settings, and contact the Security Desk to lock withdrawal capabilities while your account is secured.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/workers/account-security#webpage",
        "url": "https://smartexn.com/workers/account-security",
        "name": "Worker Account Security & Balance Protection Guide | SmartExn",
        "description": "Essential security practices for SmartExn workers: Two-Factor Authentication (2FA), phishing prevention, credential hygiene, and balance protection.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/workers/account-security#breadcrumb",
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
            "name": "Account Security",
            "item": "https://smartexn.com/workers/account-security"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/workers/account-security#faq",
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
        title="Worker Account Security & Balance Protection Guide | SmartExn"
        description="Essential security practices for SmartExn workers: Two-Factor Authentication (2FA), phishing prevention, credential hygiene, and balance protection."
        canonicalUrl="https://smartexn.com/workers/account-security"
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
          <span className="text-sky-400 font-medium">Account Security</span>
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
            Worker Account Security: 2FA, Wallet Safety & Phishing Protection
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Essential security guidelines for keeping your SmartExn account, earned wallet balances, and personal information completely protected.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Why Security Is Paramount for Workers
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            As you accumulate earnings from micro-tasks and market research surveys, protecting your account credentials ensures your funds remain secure until you are ready to withdraw. SmartExn employs enterprise-grade cryptographic encryption and strict session controls to safeguard user accounts.
          </p>
        </section>

        {/* 4 Security Pillars */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Security Rules for Every Worker
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Enable Two-Factor Authentication</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Connect a TOTP authenticator app (such as Google Authenticator) to require a dynamic verification code during login.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Beware of External Phishing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Never enter your SmartExn login credentials on third-party websites linked in task briefs or external chat rooms.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Use Unique Passwords</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Ensure your SmartExn password is unique and not reused on other freelance platforms or public forums.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Whitelist Withdrawal Addresses</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Lock your payout wallet addresses in Account Settings to prevent unauthorized destination modifications.
              </p>
            </div>
          </div>
        </section>

        {/* Quality Guidelines */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Reporting Suspicious Campaigns
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            If a task brief asks you to pay upfront fees, download suspicious executable (.exe) files, or disclose private financial credentials, immediately click the "Report Campaign" button. The SmartExn Trust & Safety team will freeze the campaign pending an immediate security audit.
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
            <Link to="/trust-and-safety/fraud-prevention" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Platform Fraud Prevention Architecture
            </Link>
            <Link to="/trust-and-safety/account-security" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Enterprise Infrastructure & Account Security
            </Link>
            <Link to="/workers/reward-and-withdrawal-guide" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → Worker Rewards & Withdrawal Policy
            </Link>
            <Link to="/trust-and-safety" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-sky-500/40 text-sky-400 hover:text-sky-300 transition-colors">
              → SmartExn Trust & Safety Overview
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Secure Your SmartExn Account</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Log in and review your account security settings, enable 2FA, and protect your earnings.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-sky-500/20 whitespace-nowrap shrink-0"
            >
              Account Settings
            </Link>
            <Link
              to="/trust-and-safety"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Trust & Safety Hub
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};
