import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { seoAnalytics } from '../services/seoAnalytics';

interface KBArticle {
  id: string;
  title: string;
  category: 'workers' | 'advertisers' | 'trust';
  categoryLabel: string;
  description: string;
  path: string;
  readTime: string;
  keywords: string[];
}

const articlesData: KBArticle[] = [
  {
    id: 'social-media-tasks',
    title: 'Social Media Engagement & Community Tasks',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Learn requirements for social media channel follows, video views, valid proof capture, and avoiding rejections.',
    path: '/micro-tasks/social-media-tasks',
    readTime: '4 min read',
    keywords: ['social media tasks', 'follow', 'subscribe', 'engagement', 'micro tasks']
  },
  {
    id: 'proof-based-tasks',
    title: 'Proof-Based Tasks: Verification & Approval Rules',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Deep dive into evidence evaluation, perceptual hashing, and advertiser validation criteria for proof-based gigs.',
    path: '/micro-tasks/proof-based-tasks',
    readTime: '4 min read',
    keywords: ['proof based tasks', 'proof rules', 'verification', 'evidence', 'approval']
  },
  {
    id: 'survey-quality',
    title: 'Survey Response Quality & Account Health',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Understand how market research panels evaluate data consistency, open-ended answers, and speeder traps.',
    path: '/paid-surveys/survey-quality',
    readTime: '4 min read',
    keywords: ['survey quality', 'speeder traps', 'response consistency', 'account health']
  },
  {
    id: 'complete-micro-tasks',
    title: 'How to Complete Micro-Tasks Successfully',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Learn how to discover available tasks, follow advertiser instructions, capture valid proof, and earn verified rewards.',
    path: '/knowledge-base/how-to-complete-micro-tasks',
    readTime: '4 min read',
    keywords: ['micro-tasks', 'complete tasks', 'worker guide', 'how to earn', 'task steps']
  },
  {
    id: 'how-to-find-tasks',
    title: 'How to Find High-Paying Tasks on SmartExn',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Master the task marketplace search filters, identify top-tier gigs, and optimize your daily workflow.',
    path: '/workers/how-to-find-tasks',
    readTime: '4 min read',
    keywords: ['find tasks', 'high paying gigs', 'filters', 'search tasks', 'daily work']
  },
  {
    id: 'how-to-submit-proof',
    title: 'How to Submit Valid Task Proof',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Step-by-step guide on capturing uncropped screenshots, entering usernames, and ensuring instant approval.',
    path: '/workers/how-to-submit-proof',
    readTime: '4 min read',
    keywords: ['submit proof', 'screenshots', 'usernames', 'approval', 'task proof']
  },
  {
    id: 'how-to-avoid-rejections',
    title: 'How to Avoid Micro-Task Rejections',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Discover the top reasons why submissions are rejected and maintain a pristine 95%+ approval rating.',
    path: '/workers/how-to-avoid-task-rejection',
    readTime: '4 min read',
    keywords: ['avoid rejections', 'approval rate', 'disputes', 'mistakes', 'quality']
  },
  {
    id: 'task-completion-tips',
    title: 'Task Completion Tips & Speed Shortcuts',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Productivity tips, keyboard shortcuts, and batching strategies to maximize your hourly earnings.',
    path: '/workers/task-completion-tips',
    readTime: '4 min read',
    keywords: ['completion tips', 'shortcuts', 'productivity', 'efficiency', 'batching']
  },
  {
    id: 'worker-account-security',
    title: 'Worker Account Security & 2FA Setup',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Protect your account credentials, earnings, and withdrawal addresses with Two-Factor Authentication.',
    path: '/workers/account-security',
    readTime: '4 min read',
    keywords: ['account security', '2fa', 'authenticator', 'protect earnings', 'phishing']
  },
  {
    id: 'reward-and-withdrawal-guide',
    title: 'Worker Rewards & Withdrawal Policy Guide',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Comprehensive guide to escrow disbursement, available balances, payout methods, and withdrawal timelines.',
    path: '/workers/reward-and-withdrawal-guide',
    readTime: '5 min read',
    keywords: ['rewards', 'withdrawals', 'payouts', 'crypto', 'thresholds']
  },
  {
    id: 'task-proof-guide',
    title: 'Visual Task Proof Guide & Examples',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'A detailed manual on screenshot formats, social handles, submission URLs, reference codes, and avoiding rejections.',
    path: '/task-proof',
    readTime: '5 min read',
    keywords: ['task proof', 'screenshots', 'proof submission', 'valid proof', 'evidence']
  },
  {
    id: 'app-testing-tasks',
    title: 'Mobile App Testing Tasks & QA Guide',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'How to install test builds from official app stores, verify functionality, and submit bug reports.',
    path: '/micro-tasks/app-testing',
    readTime: '4 min read',
    keywords: ['app testing', 'mobile apps', 'qa testing', 'bug reporting', 'ios android']
  },
  {
    id: 'website-testing-tasks',
    title: 'Website Usability & Navigation Tasks',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Explore website testing tasks, user journey verification, and link validation requirements.',
    path: '/micro-tasks/website-testing',
    readTime: '4 min read',
    keywords: ['website testing', 'usability', 'navigation', 'browser testing', 'links']
  },
  {
    id: 'data-verification-tasks',
    title: 'Data Verification & Labeling Micro-Tasks',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Learn how to review directory entries, categorize e-commerce products, and verify business information.',
    path: '/micro-tasks/data-verification',
    readTime: '4 min read',
    keywords: ['data verification', 'labeling', 'data cleansing', 'categorization']
  },
  {
    id: 'research-tasks',
    title: 'Online Research & Data Sourcing Tasks',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Find public pricing data, business registries, and verified directory contacts online.',
    path: '/micro-tasks/research-tasks',
    readTime: '4 min read',
    keywords: ['research tasks', 'web research', 'price comparison', 'directory search']
  },
  {
    id: 'how-surveys-work',
    title: 'How Online Paid Surveys Work',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Understand the market research ecosystem, survey routers, and how opinion studies compensate respondents.',
    path: '/paid-surveys/how-online-surveys-work',
    readTime: '4 min read',
    keywords: ['how surveys work', 'market research', 'opinion polling', 'rewards']
  },
  {
    id: 'survey-qualification',
    title: 'Survey Qualification & Demographic Profiles',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Learn how demographic matching works and how keeping an updated profile increases your qualification rate.',
    path: '/paid-surveys/survey-qualification',
    readTime: '4 min read',
    keywords: ['survey qualification', 'demographics', 'profile match', 'targeting']
  },
  {
    id: 'survey-screen-outs',
    title: 'Understanding Survey Screen-Outs & Quotas',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'Why screen-outs happen, demographic quotas, and actionable strategies to minimize disqualifications.',
    path: '/paid-surveys/survey-screen-outs',
    readTime: '4 min read',
    keywords: ['screen-outs', 'disqualification', 'quotas full', 'demographic screening']
  },
  {
    id: 'attention-checks',
    title: 'Passing Attention Checks & Quality Traps',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'How to spot trap questions, consistency verification, and timing checks in market research surveys.',
    path: '/paid-surveys/attention-checks',
    readTime: '4 min read',
    keywords: ['attention checks', 'quality traps', 'survey consistency', 'speeders']
  },
  {
    id: 'survey-rewards',
    title: 'Survey Rewards & Payout Structures',
    category: 'workers',
    categoryLabel: 'Workers',
    description: 'How survey incentives are calculated, credited to your wallet, and disbursed upon survey completion.',
    path: '/paid-surveys/survey-rewards',
    readTime: '4 min read',
    keywords: ['survey rewards', 'incentives', 'cpc', 'instant crediting']
  },

  // Advertisers Category
  {
    id: 'how-to-create-campaign',
    title: 'How to Create a Micro-Task Campaign on SmartExn',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Step-by-step walkthrough of campaign publishing, task requirement setup, budget allocation in escrow, and proof verification.',
    path: '/knowledge-base/how-to-create-a-campaign',
    readTime: '5 min read',
    keywords: ['create campaign', 'publish task', 'advertiser guide', 'campaign budget', 'escrow']
  },
  {
    id: 'social-media-campaigns',
    title: 'Crowdsourced Social Media Campaigns',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Scale authentic channel subscriptions, community growth, and verified post engagement with escrow safety.',
    path: '/advertise/social-media-campaigns',
    readTime: '4 min read',
    keywords: ['social media campaigns', 'followers', 'youtube', 'telegram', 'discord']
  },
  {
    id: 'app-testing-campaigns',
    title: 'Mobile App Testing & QA Campaigns',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Collect real-device QA feedback, bug reports, and UX reviews across global device ecosystems.',
    path: '/advertise/app-testing-campaigns',
    readTime: '4 min read',
    keywords: ['app testing campaigns', 'mobile qa', 'play store', 'app store', 'testflight']
  },
  {
    id: 'website-testing-campaigns',
    title: 'Website Usability & Funnel Testing Campaigns',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Validate conversion funnels, test cross-browser responsiveness, and audit web navigation.',
    path: '/advertise/website-testing-campaigns',
    readTime: '4 min read',
    keywords: ['website testing campaigns', 'ux testing', 'conversion', 'form validation']
  },
  {
    id: 'survey-campaigns',
    title: 'Market Research & Consumer Survey Campaigns',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Acquire verified consumer insights from targeted demographic segments with S2S postback tracking.',
    path: '/advertise/survey-campaigns',
    readTime: '4 min read',
    keywords: ['survey campaigns', 'market research', 'demographics', 'postbacks', 'cpc']
  },
  {
    id: 'data-verification-campaigns',
    title: 'Data Verification & Annotation Campaigns',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Outsource data cleansing, classification, image labeling, and directory validation to human contributors.',
    path: '/advertise/data-verification-campaigns',
    readTime: '4 min read',
    keywords: ['data verification campaigns', 'annotation', 'cleansing', 'labeling', 'hitl']
  },
  {
    id: 'crowdsourced-research-campaigns',
    title: 'Crowdsourced Web & Competitive Research',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'Deploy distributed search queries to gather competitor pricing, directory contacts, and market facts.',
    path: '/advertise/crowdsourced-research',
    readTime: '4 min read',
    keywords: ['crowdsourced research', 'competitive pricing', 'directory sourcing', 'web research']
  },
  {
    id: 'crowdsourced-workforce-guide',
    title: 'What Is a Crowdsourced Workforce?',
    category: 'advertisers',
    categoryLabel: 'Advertisers',
    description: 'How distributed micro-task workforces power social engagement, application quality assurance, market research, and testing.',
    path: '/knowledge-base/crowdsourced-workforce-guide',
    readTime: '5 min read',
    keywords: ['crowdsourced workforce', 'distributed tasks', 'b2b advertising', 'qa testing']
  },

  // Trust & Safety Category
  {
    id: 'escrow-protection',
    title: '100% Upfront Escrow Protection Architecture',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'How SmartExn guarantees 100% funded campaign escrow, automated review timers, and double-entry settlements.',
    path: '/trust-and-safety/escrow',
    readTime: '5 min read',
    keywords: ['escrow protection', 'upfront escrow', 'guaranteed payments', 'timers']
  },
  {
    id: 'proof-verification-system',
    title: 'Proof Verification & Perceptual Hashing (pHash)',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'Learn how perceptual image hashing, EXIF analysis, and manual inspection eliminate duplicate proof submissions.',
    path: '/trust-and-safety/proof-verification',
    readTime: '4 min read',
    keywords: ['proof verification', 'phash', 'duplicate detection', 'image integrity']
  },
  {
    id: 'fraud-prevention-system',
    title: 'Platform Fraud Prevention & Sybil Attack Defense',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'Overview of automated bot defense, browser fingerprinting, behavioral velocity monitoring, and multi-account clustering.',
    path: '/trust-and-safety/fraud-prevention',
    readTime: '5 min read',
    keywords: ['fraud prevention', 'bot defense', 'sybil attacks', 'fingerprinting']
  },
  {
    id: 'two-tier-dispute-system',
    title: 'Two-Tier Dispute Desk & Administrative Arbitration',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'How Level-1 direct clarification and Level-2 impartial moderator arbitration guarantee fair outcomes.',
    path: '/trust-and-safety/disputes',
    readTime: '5 min read',
    keywords: ['disputes', 'arbitration', 'proof appeal', 'admin review', 'resolution']
  },
  {
    id: 'enterprise-account-security',
    title: 'Enterprise Infrastructure & Fund Security',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'TLS 1.3 encryption, AES-256 storage, 2FA enforcement, and cold multi-signature reserve vaults.',
    path: '/trust-and-safety/account-security',
    readTime: '5 min read',
    keywords: ['account security', 'encryption', 'tls 1.3', 'aes-256', 'vaults']
  },
  {
    id: 'trust-and-safety-hub',
    title: 'SmartExn Trust & Safety Overview',
    category: 'trust',
    categoryLabel: 'Trust & Safety',
    description: 'Central overview of safety architecture, escrow protection, community standards, and compliance.',
    path: '/trust-and-safety',
    readTime: '5 min read',
    keywords: ['trust and safety', 'platform overview', 'escrow rules', 'safety standards']
  }
];

export const KnowledgeBase: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'workers' | 'advertisers' | 'trust'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://smartexn.com/knowledge-base#webpage",
        "url": "https://smartexn.com/knowledge-base",
        "name": "SmartExn Knowledge Base — Tasks, Campaigns, Proof & Rewards",
        "description": "Centralized educational knowledge base for SmartExn. In-depth guides on completing micro-tasks, submitting proof, creating campaigns, and platform trust.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://smartexn.com/#website",
          "name": "SmartExn",
          "url": "https://smartexn.com/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://smartexn.com/knowledge-base#breadcrumb",
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
          }
        ]
      }
    ]
  };

  const filteredArticles = articlesData.filter(article => {
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const titleMatch = article.title.toLowerCase().includes(q);
    const descMatch = article.description.toLowerCase().includes(q);
    const catMatch = article.categoryLabel.toLowerCase().includes(q);
    const keywordMatch = article.keywords.some(k => k.toLowerCase().includes(q));

    return titleMatch || descMatch || catMatch || keywordMatch;
  });

  return (
    <div className="min-h-screen bg-[#061325] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      <SEOHead
        title="SmartExn Knowledge Base — Tasks, Campaigns, Proof & Rewards"
        description="Centralized educational knowledge base for SmartExn. In-depth guides on completing micro-tasks, submitting proof, creating campaigns, and platform trust."
        canonical="https://smartexn.com/knowledge-base"
        robots="index, follow"
        schemaJson={schemaData}
      />

      <PublicNavHeader activePage="knowledge-base" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-20 overflow-hidden border-b border-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
            
            {/* Breadcrumb pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-xs font-semibold text-sky-300">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-200">Knowledge Base</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              SmartExn Knowledge Base — Tasks, Campaigns, Proof & Rewards
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              Explore step-by-step guides, best practices, and official platform documentation for task earners, advertisers, and community members.
            </p>

            {/* Client-Side Search Bar */}
            <div className="max-w-2xl mx-auto pt-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search guides, proof rules, campaign setup, keywords..."
                  className="w-full px-5 py-4 pl-12 rounded-2xl bg-[#0b1f36] border border-sky-500/30 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm shadow-xl"
                  aria-label="Search Knowledge Base articles"
                />
                <svg
                  className="w-5 h-5 text-sky-400 absolute left-4 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-md"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {[
                { key: 'all', label: 'All Articles' },
                { key: 'workers', label: 'For Workers' },
                { key: 'advertisers', label: 'For Advertisers' },
                { key: 'trust', label: 'Trust & Safety' }
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => {
                    setSelectedCategory(cat.key as any);
                    seoAnalytics.trackNavClick(`KB Filter: ${cat.label}`, `/knowledge-base?cat=${cat.key}`, 'header');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-sky-400 focus:outline-none ${
                    selectedCategory === cat.key
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 border border-sky-400'
                      : 'bg-[#0b1f36] text-slate-300 border border-slate-700 hover:border-sky-500/50 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Start Here / Recommended Essentials (Visible when not searching and on 'all') */}
        {selectedCategory === 'all' && !searchQuery.trim() && (
          <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Essential Onboarding</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">Recommended Starting Points</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/knowledge-base/how-to-complete-micro-tasks"
                onClick={() => seoAnalytics.trackArticleClick('complete-micro-tasks', 'How to Complete Micro-Tasks Successfully', 'workers')}
                className="p-5 rounded-2xl bg-gradient-to-b from-sky-950/60 to-[#0b1f36] border border-sky-500/30 hover:border-sky-400 transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 inline-block mb-2">Worker Essential</span>
                  <h3 className="font-bold text-white group-hover:text-sky-300 text-sm">How to Complete Micro-Tasks</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Master discovery, step instructions, proof requirements, and reward crediting.</p>
                </div>
                <span className="text-xs font-semibold text-sky-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">Read Guide →</span>
              </Link>

              <Link
                to="/task-proof"
                onClick={() => seoAnalytics.trackArticleClick('task-proof-guide', 'Visual Task Proof Guide & Examples', 'workers')}
                className="p-5 rounded-2xl bg-gradient-to-b from-sky-950/60 to-[#0b1f36] border border-sky-500/30 hover:border-sky-400 transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 inline-block mb-2">Proof Rules</span>
                  <h3 className="font-bold text-white group-hover:text-sky-300 text-sm">Visual Task Proof Guide</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Acceptable screenshot formats, username checks, and avoiding proof rejections.</p>
                </div>
                <span className="text-xs font-semibold text-sky-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">Read Guide →</span>
              </Link>

              <Link
                to="/knowledge-base/how-to-create-a-campaign"
                onClick={() => seoAnalytics.trackArticleClick('how-to-create-campaign', 'How to Create a Micro-Task Campaign', 'advertisers')}
                className="p-5 rounded-2xl bg-gradient-to-b from-sky-950/60 to-[#0b1f36] border border-sky-500/30 hover:border-sky-400 transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 inline-block mb-2">Advertiser Setup</span>
                  <h3 className="font-bold text-white group-hover:text-sky-300 text-sm">How to Create a Campaign</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Budget allocation, instructions clarity, proof fields, and review workflows.</p>
                </div>
                <span className="text-xs font-semibold text-sky-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">Read Guide →</span>
              </Link>

              <Link
                to="/trust-and-safety/escrow"
                onClick={() => seoAnalytics.trackArticleClick('escrow-protection', '100% Upfront Escrow Protection', 'trust')}
                className="p-5 rounded-2xl bg-gradient-to-b from-sky-950/60 to-[#0b1f36] border border-sky-500/30 hover:border-sky-400 transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 inline-block mb-2">Trust & Safety</span>
                  <h3 className="font-bold text-white group-hover:text-sky-300 text-sm">100% Escrow Protection</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Double-entry ledger, automated timer safeguards, and refund policies.</p>
                </div>
                <span className="text-xs font-semibold text-sky-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">Read Guide →</span>
              </Link>
            </div>
          </section>
        )}

        {/* Articles Grid Section */}
        <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex justify-between items-center pb-2 border-b border-sky-950">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Showing {filteredArticles.length} {filteredArticles.length === 1 ? 'guide' : 'guides'}
            </span>
            {searchQuery && (
              <span className="text-xs text-sky-400">
                Filtered by &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          {filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <Link
                  key={article.id}
                  to={article.path}
                  onClick={() => seoAnalytics.trackArticleClick(article.id, article.title, article.category)}
                  className="group bg-[#0b1f36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                          article.category === 'workers'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : article.category === 'advertisers'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {article.categoryLabel}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{article.readTime}</span>
                    </div>

                    <h2 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors leading-snug">
                      {article.title}
                    </h2>

                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed line-clamp-3">
                      {article.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-sky-400 group-hover:text-sky-300">
                    <span>Read Guide</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-[#0b1f36] rounded-3xl border border-sky-500/20 p-8 space-y-4 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-sky-950 text-sky-400 flex items-center justify-center mx-auto text-2xl">
                🔍
              </div>
              <h3 className="text-lg font-bold text-white">No Matching Guides Found</h3>
              <p className="text-slate-400 text-sm">
                We could not find any articles matching &quot;{searchQuery}&quot;. Try searching for &quot;proof&quot;, &quot;campaign&quot;, &quot;surveys&quot;, or &quot;escrow&quot;.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </section>

        {/* Bottom CTA */}
        <section className="py-16 bg-gradient-to-b from-transparent to-[#040e1c]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 border border-sky-500/30 shadow-2xl space-y-6">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Have Additional Questions?
              </h2>
              <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                Explore our comprehensive FAQs or connect directly with our support team.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <Link
                  to="/faqs"
                  className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all"
                >
                  Knowledge Base FAQs
                </Link>
                <Link
                  to="/trust-and-safety"
                  className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all"
                >
                  Trust & Safety Policy
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

export default KnowledgeBase;
