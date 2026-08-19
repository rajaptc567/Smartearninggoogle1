import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedProofGuides: GuideItem[] = [
  {
    title: 'Why Tasks Get Rejected & How to Fix Common Errors',
    description: 'Comprehensive analysis of the top reasons for task rejection and how to maintain high approval rates.',
    to: '/knowledge-base/why-tasks-get-rejected',
    category: 'Workers',
    tag: 'Quality'
  },
  {
    title: 'How to Complete Micro-Tasks Successfully',
    description: 'Learn step-by-step instructions on discovering gigs, capturing valid proof, and earning verified rewards.',
    to: '/knowledge-base/how-to-complete-micro-tasks',
    category: 'Workers',
    tag: 'Essential'
  },
  {
    title: 'Proof Verification & Perceptual Hashing (pHash)',
    description: 'Automated screenshot deduplication, metadata integrity, and manual verification protocols.',
    to: '/trust-and-safety/proof-verification',
    category: 'Trust & Safety',
    tag: 'Verification'
  },
  {
    title: 'Two-Tier Dispute Resolution System',
    description: 'Direct creator negotiation and impartial admin arbitration workflows for rejected proof claims.',
    to: '/trust-and-safety/disputes',
    category: 'Trust & Safety',
    tag: 'Disputes'
  },
  {
    title: 'How to Submit Proof for Micro-Tasks',
    description: 'Detailed instructions on proof capture tools, upload limits, and text field completion.',
    to: '/workers/how-to-submit-proof',
    category: 'Workers',
    tag: 'Worker Guide'
  },
  {
    title: 'Worker Account Security & Multi-Accounting Policy',
    description: 'Maintain healthy standing, device integrity, and prevent account flags under SmartExn rules.',
    to: '/workers/account-security',
    category: 'Workers',
    tag: 'Security'
  }
];

const proofFaqs = [
  {
    question: "What format should my screenshot proof be in?",
    answer: "Submit clear, uncropped PNG or JPEG images captured directly on your device. Ensure the entire screen is visible, including the status bar or browser URL bar, timestamps, and the completed action (like, follow, or install)."
  },
  {
    question: "Can I use the same screenshot for two different tasks?",
    answer: "No. Reusing screenshots or submitting duplicate proof across different tasks is strictly prohibited and can lead to immediate submission rejection and account penalties."
  },
  {
    question: "What should I do if the task proof form asks for a URL?",
    answer: "Copy and paste the exact public direct link to your published comment, shared post, or profile page. Verify the link is publicly viewable without requiring the advertiser to log into your account."
  },
  {
    question: "What happens if my proof is rejected?",
    answer: "If an advertiser rejects your proof with reason, you can review their feedback. If you believe the rejection was a mistake and your proof met all instructions, you can open a dispute through our two-tier dispute desk."
  }
];

export const TaskProofGuide: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/task-proof#webpage",
        "url": "https://smartexn.com/task-proof",
        "name": "How to Submit Valid Task Proof | SmartExn",
        "description": "Step-by-step guidelines on submitting valid task proof on SmartExn. Learn acceptable screenshot guidelines, handle submissions, and how to avoid proof rejection.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/task-proof#breadcrumb",
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
            "name": "Task Proof Guide",
            "item": "https://smartexn.com/task-proof"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/task-proof#faq",
        "mainEntity": proofFaqs.map(item => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="How to Submit Valid Task Proof | SmartExn"
        description="Step-by-step guidelines on submitting valid task proof on SmartExn. Learn acceptable screenshot guidelines, handle submissions, and how to avoid proof rejection."
        canonical="https://smartexn.com/task-proof"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="task-proof" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Task Proof Guide</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              How to Submit Valid Task Proof on SmartExn
            </h1>

            <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto leading-relaxed">
              Submitting accurate, verifiable proof is the key to fast task approvals and steady reward earnings. Review acceptable formats, avoid common pitfalls, and master proof submissions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/micro-tasks"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-lg transition-all text-center"
              >
                Browse Micro-Tasks
              </Link>
              <Link
                to="/how-it-works-for-workers"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base transition-all text-center"
              >
                How It Works for Workers
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: What Is Task Proof? */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
            <div className="inline-block px-3 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
              Proof Fundamentals
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              What Is Task Proof?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Task proof is the verifiable digital evidence you provide to demonstrate that you followed all published instructions and successfully completed a campaign.
            </p>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Advertisers rely on this evidence to audit quality before releasing reward funds held in escrow. Clear, accurate proof ensures prompt approvals and maintains your account's high reputation score.
            </p>
          </div>
        </section>

        {/* Section 2: Examples of Acceptable Proof */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Examples of Acceptable Proof
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Depending on the campaign type, you will be requested to supply one or more of the following proof formats:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Screenshots */}
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3">
                <span className="text-2xl">📱</span>
                <h3 className="text-lg font-bold text-white">Screenshots</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Full-screen unedited captures showing subscribed channels, installed apps on your home screen, or order confirmation screens.
                </p>
              </div>

              {/* Usernames and Handles */}
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3">
                <span className="text-2xl">👤</span>
                <h3 className="text-lg font-bold text-white">Usernames and Handles</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Your exact public social handle (e.g. @username) used to perform the interaction so the creator can audit their subscriber list.
                </p>
              </div>

              {/* URLs and Reference IDs */}
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3">
                <span className="text-2xl">🔗</span>
                <h3 className="text-lg font-bold text-white">URLs and Reference IDs</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Direct permalinks to your comment, share URL, or confirmation transaction code generated upon completing a form.
                </p>
              </div>

              {/* Required Text Responses */}
              <div className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl p-6 space-y-3">
                <span className="text-2xl">✍️</span>
                <h3 className="text-lg font-bold text-white">Required Text Responses</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Specific answers to comprehension questions asked in the task description to prove you visited a specific page or watched a video.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 & 4: Common Proof Mistakes & Why Proof Can Be Rejected */}
        <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-4 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Common Proof Mistakes & Why Proof Gets Rejected
            </h2>
            <p className="text-slate-400 text-sm">
              Avoid these frequent errors to ensure your submissions are approved without delay.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm">1. Cropped or Blurry Images</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Cropping out your notification bar, URL address bar, or timestamps prevents the creator from verifying that the action was taken freshly by you.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm">2. Handle Typographical Errors</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Typing an incorrect username makes it impossible for advertisers to locate your follow or comment in their activity logs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm">3. Partial Task Completion</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Submitting proof after doing only 1 of 3 required steps (e.g. liking a video but forgetting to leave the required constructive comment).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b1f36] border border-red-500/20 space-y-2">
              <h3 className="font-bold text-red-400 text-sm">4. Expired Slot Timer</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Starting a task but waiting too long to submit. If your reservation timer runs out, your slot is released back to the general pool.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: How to Improve Your Submission */}
        <section className="py-16 bg-[#040e1c] border-y border-sky-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="bg-[#0b1f36] border border-sky-500/20 rounded-3xl p-8 sm:p-12 space-y-6 shadow-xl">
              <div className="inline-block px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Best Practices
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                How to Improve Your Submission
              </h2>
              <div className="space-y-4 text-slate-300 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <p><strong>Capture uncropped full screens:</strong> Always take full device screenshots showing relevant context and time.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <p><strong>Double check usernames:</strong> Verify your input matches the exact platform profile used.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <p><strong>Review requirements one last time:</strong> Before clicking submit, check off every single requirement requested by the creator.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Frequently Asked Questions */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm">
              Quick answers regarding proof files, submission rules, and dispute procedures.
            </p>
          </div>

          <div className="space-y-4">
            {proofFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#0b1f36] border border-sky-500/20 rounded-2xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-start justify-between gap-4 font-bold text-white hover:text-sky-400 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none"
                  >
                    <span className="text-base sm:text-lg leading-snug">{faq.question}</span>
                    <span className="text-xl text-sky-400 font-bold shrink-0">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-slate-300 text-sm leading-relaxed border-t border-sky-900/40 pt-4">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4 flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/knowledge-base/why-tasks-get-rejected" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Why Tasks Get Rejected</span>
              <span>→</span>
            </Link>
            <Link to="/knowledge-base" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Knowledge Base Hub</span>
              <span>→</span>
            </Link>
            <Link to="/trust-and-safety" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>View Trust & Safety Policy</span>
              <span>→</span>
            </Link>
            <Link to="/terms-of-use" className="text-sky-400 hover:text-sky-300 font-bold inline-flex items-center gap-1">
              <span>Terms of Use</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Related Educational Guides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <RelatedGuides guides={relatedProofGuides} />
        </div>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Ready to Complete Tasks?
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Put your knowledge into practice and start earning rewards with verified task proof.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/register"
                  onClick={() => seoAnalytics.trackRegisterCtaClick('/task-proof', 'worker')}
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/micro-tasks"
                  onClick={() => seoAnalytics.trackWorkerCtaClick('Browse Micro-Tasks (Task Proof Bottom)', '/task-proof')}
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Browse Micro-Tasks
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

export default TaskProofGuide;
