import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PublicNavHeader } from '../../components/PublicNavHeader';
import { PublicFooter } from '../../components/PublicFooter';

export const EnterpriseAccountSecurity: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What encryption standards does SmartExn use?',
      a: 'All data in transit is protected using modern HTTPS encryption. User credentials and sensitive security parameters are securely hashed.'
    },
    {
      q: 'How does SmartExn secure withdrawal requests?',
      a: 'Withdrawal requests require account authentication, destination address verification, and administrator compliance review before disbursement.'
    },
    {
      q: 'How are session cookies and authentication protected?',
      a: 'SmartExn issues scoped session tokens and secure cookies to protect active sessions against unauthorized access.'
    },
    {
      q: 'How can users secure their individual accounts?',
      a: 'Users are encouraged to use strong unique passwords, keep their registered email secure, and never share login credentials.'
    }
  ];

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety/account-security#webpage",
        "url": "https://smartexn.com/trust-and-safety/account-security",
        "name": "Account Security & Infrastructure Standards | SmartExn",
        "description": "Learn about SmartExn account security standards: HTTPS encryption, secure session tokens, password hashing, and payout verification controls.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety/account-security#breadcrumb",
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
            "name": "Trust & Safety",
            "item": "https://smartexn.com/trust-and-safety"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Account Security",
            "item": "https://smartexn.com/trust-and-safety/account-security"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/trust-and-safety/account-security#faq",
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
        title="Account Security & Infrastructure Standards | SmartExn"
        description="Learn about SmartExn account security standards: HTTPS encryption, secure session tokens, password hashing, and payout verification controls."
        canonicalUrl="https://smartexn.com/trust-and-safety/account-security"
        schema={schemaData}
      />
      <PublicNavHeader activePage="trust-and-safety" />

      {/* Visual Breadcrumbs */}
      <div className="bg-slate-900/70 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-400 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-sky-400 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/trust-and-safety" className="hover:text-sky-400 transition-colors">Trust & Safety</Link>
          <span>/</span>
          <span className="text-sky-400 font-medium">Account Security</span>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/50 text-xs font-semibold text-emerald-400">
            <span>Trust & Safety Architecture</span>
            <span>•</span>
            <span>5 Min Read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Account Security & Platform Protection Standards
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            An overview of the access controls, encryption protocols, session hygiene, and verification layers protecting SmartExn accounts and balances.
          </p>
        </header>

        {/* Overview */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            1. Platform Security Architecture
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Security at SmartExn is embedded into every layer of our platform. From the separation of worker and advertiser wallets to secure authentication endpoints, our infrastructure protects user accounts and transaction history.
          </p>
        </section>

        {/* 4 Pillars */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            2. 4 Pillars of Account Protection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">1. Secure HTTPS Transport</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                All platform communication is encrypted end-to-end using standard HTTPS protocols to protect data in transit.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">2. Password & Credential Hashing</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                User passwords are cryptographic hashed before storage, ensuring credentials remain protected.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">3. Balance & Wallet Isolation</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Task earnings, campaign escrow pools, and commission balances are tracked in isolated, double-entry ledger structures.
              </p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">4. Withdrawal Verification</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Withdrawals are audited against minimum thresholds, verified payment methods, and account compliance checks.
              </p>
            </div>
          </div>
        </section>

        {/* Session Hygiene */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            3. Session Hygiene & Threat Mitigation
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            All user sessions utilize scoped JSON Web Tokens and strict SameSite cookie policies. Automated rate limiting prevents brute-force credential attacks, while continuous monitoring flags anomalous login attempts across geographic regions.
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
          <h3 className="text-base font-bold text-white">Related Trust & Safety Topics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <Link to="/trust-and-safety/escrow" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → 100% Upfront Escrow Protection System
            </Link>
            <Link to="/trust-and-safety/fraud-prevention" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Fraud Prevention & Sybil Defense Architecture
            </Link>
            <Link to="/workers/account-security" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → Worker Guide to Account Security & 2FA
            </Link>
            <Link to="/trust-and-safety" className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-colors">
              → SmartExn Trust & Safety Hub
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">Security Without Compromise</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Experience the peace of mind of enterprise-grade fund security on SmartExn.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap shrink-0"
            >
              Create Account
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
