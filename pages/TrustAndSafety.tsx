import React from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedTrustGuides: GuideItem[] = [
  {
    title: '100% Upfront Escrow Protection Architecture',
    description: 'Double-entry ledger, automated timer safeguards, and refund policies for unused campaign budgets.',
    to: '/trust-and-safety/escrow',
    category: 'Escrow',
    tag: 'Financial Safety'
  },
  {
    title: 'Two-Tier Dispute Resolution System',
    description: 'Direct creator negotiation and impartial admin arbitration workflows for rejected proof claims.',
    to: '/trust-and-safety/disputes',
    category: 'Arbitration',
    tag: 'Disputes'
  },
  {
    title: 'Proof Verification & Perceptual Hashing (pHash)',
    description: 'Automated screenshot deduplication, metadata integrity, and manual verification protocols.',
    to: '/trust-and-safety/proof-verification',
    category: 'Verification',
    tag: 'Integrity'
  },
  {
    title: 'Multi-Layer Fraud Prevention Architecture',
    description: 'Bot mitigation, multi-accounting detection, device fingerprinting, and VPN/proxy safeguards.',
    to: '/trust-and-safety/fraud-prevention',
    category: 'Security',
    tag: 'Anti-Fraud'
  },
  {
    title: 'Enterprise Account Security & Access Controls',
    description: '2FA authentication, session protection, salted hashing, and audit-logged administrative roles.',
    to: '/trust-and-safety/account-security',
    category: 'Security',
    tag: 'Account Safety'
  },
  {
    title: 'Terms of Use & Code of Conduct',
    description: 'Official rules of platform engagement for workers, advertisers, and community members.',
    to: '/terms-of-use',
    category: 'Legal',
    tag: 'Policies'
  }
];

export const TrustAndSafety: React.FC = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/trust-and-safety#webpage",
        "url": "https://smartexn.com/trust-and-safety",
        "name": "SmartExn Trust & Safety | Task & Campaign Protection",
        "description": "Learn about SmartExn platform integrity, 100% upfront campaign escrow, proof verification, anti-fraud rules, two-tier dispute resolution, and community standards.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/trust-and-safety#breadcrumb",
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
          }
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="SmartExn Trust & Safety | Task & Campaign Protection"
        description="Learn about SmartExn platform integrity, 100% upfront campaign escrow, proof verification, anti-fraud rules, two-tier dispute resolution, and community standards."
        canonical="https://smartexn.com/trust-and-safety"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="trust-and-safety" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Trust & Safety</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              SmartExn Trust & Safety
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Transparent operational standards, upfront campaign escrow, dispute arbitration, and anti-fraud protocols protecting both task workers and advertisers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/how-it-works"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-base shadow-lg transition-all text-center"
              >
                Explore How It Works
              </Link>
              <Link
                to="/terms-of-use"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                View Terms of Use
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: How SmartExn Protects Workers */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Worker Protection
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              How SmartExn Protects Workers
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              SmartExn is built to ensure that honest work receives fair compensation. Every task campaign published on the platform is backed by locked escrow funds deposited by the creator before any worker can claim a slot.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Furthermore, when you start a task, your position is secured by an automated reservation timer. As long as you submit accurate proof before the slot timer expires, your submission enters the review queue protected by platform rules.
            </p>
          </div>
        </section>

        {/* Section 2: How Campaign Funds Are Handled */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                How Campaign Funds Are Handled
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Our escrow architecture ensures financial safety for both sides of the marketplace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">🔒</span>
                <h3 className="font-bold text-white text-base">Upfront Escrow Locking</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Advertisers must deposit 100% of the campaign budget upfront before tasks become visible to earners.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">⚡</span>
                <h3 className="font-bold text-white text-base">Instant Credit on Approval</h3>
                <p className="text-slate-400 text-xs leading-relaxed">When an advertiser approves your submission, escrowed funds are credited immediately to your Task Earnings balance.</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#0b1f36] border border-sky-500/20 space-y-3">
                <span className="text-2xl">↩️</span>
                <h3 className="font-bold text-white text-base">Unused Fund Reclaim</h3>
                <p className="text-slate-400 text-xs leading-relaxed">If a campaign is completed or paused, unspent escrow balance is returned to the advertiser's wallet according to policy.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 & 4: Proof Verification & Fraud Prevention */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span>📸</span> Proof Verification
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Advertisers require concrete evidence to confirm task completion. This includes full-screen uncropped screenshots showing relevant timestamps, social profile usernames, or confirmation codes.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Creators must review submissions within their designated window. If a creator fails to review an entry before the review timeout, the platform automatically validates and credits the submission.
              </p>
            </div>

            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span>🛡️</span> Fraud Prevention
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                SmartExn strictly prohibits automated bots, synthetic screenshot generators, proxy manipulations, and deceptive activities.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Accounts detected attempting to submit fabricated proofs or manipulate campaign metrics face immediate task suspension, submission invalidation, and potential account closure.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 & 6: Duplicate Submissions & Account Security */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Duplicate Submission Prevention
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Campaigns are configured with per-user slot limits. Re-uploading identical screenshots across multiple tasks or creating duplicate accounts to claim the same campaign is disallowed by platform rules.
                </p>
              </div>

              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 space-y-4 shadow-xl">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Account Security
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  User accounts are protected through authenticated sessions, secure password handling, and encrypted communications. Users are encouraged to maintain strong, unique credentials and never share account details.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Dispute Resolution */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              Fair Arbitration
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Dispute Resolution
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              If an advertiser rejects your task submission and you believe your proof fulfilled all published instructions, you can access our two-tier dispute resolution desk:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs font-mono font-bold text-sky-400 uppercase">Tier 1: Direct Creator Negotiation</div>
                <h3 className="font-bold text-white text-base">Direct Re-Evaluation</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Provide supplementary proof or clarification directly to the creator for quick review and mutual resolution.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs font-mono font-bold text-amber-400 uppercase">Tier 2: Admin Arbitration</div>
                <h3 className="font-bold text-white text-base">Impartial Platform Review</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  If direct negotiation cannot resolve the dispute, an impartial support administrator examines the original instructions, submitted proof, and audit logs to make a final determination.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8 & 9: Earnings Disclosure & Reporting Suspicious Activity */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed space-y-2">
              <h2 className="text-lg font-bold text-amber-300">
                Responsible Earnings Disclosure
              </h2>
              <p>
                Earnings on SmartExn vary depending on task availability, worker accuracy, campaign requirements, and advertiser verification. SmartExn does not promise fixed hourly income, employment, or guaranteed earnings. All rewards are disbursed strictly upon verified completion of discrete tasks.
              </p>
            </div>

            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 sm:p-8 space-y-3">
              <h2 className="text-xl font-bold text-white">
                Reporting Suspicious Activity
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                If you encounter a campaign requesting inappropriate actions (such as downloading malicious software, sharing sensitive passwords, or deceptive off-platform transactions), report it immediately using the report button on the task page or through our <Link to="/faqs" className="text-sky-400 underline hover:text-white">Help Center</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <RelatedGuides guides={relatedTrustGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Join a Secure & Transparent Community
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Discover tasks or launch campaigns backed by 100% escrow protection.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/trust-and-safety', 'trust')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/faqs"
                  onClick={() => seoAnalytics.trackNavClick('Knowledge Base FAQs (Trust Bottom)', '/faqs', 'footer')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Knowledge Base FAQs
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default TrustAndSafety;
