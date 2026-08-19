import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import { RelatedGuides, GuideItem } from '../components/RelatedGuides';
import { seoAnalytics } from '../services/seoAnalytics';

const relatedFaqGuides: GuideItem[] = [
  {
    title: 'Knowledge Base & Search Directory',
    description: 'Explore our complete library of articles on worker tasks, campaign setup, and account safety.',
    to: '/knowledge-base',
    category: 'Knowledge Base',
    tag: 'Documentation'
  },
  {
    title: '100% Upfront Escrow Protection Architecture',
    description: 'How SmartExn guarantees 100% funded campaign escrow, automated review timers, and double-entry settlements.',
    to: '/trust-and-safety/escrow',
    category: 'Trust & Safety',
    tag: 'Escrow'
  },
  {
    title: 'Two-Tier Dispute Resolution System',
    description: 'Direct creator negotiation and impartial admin arbitration workflows for rejected proof claims.',
    to: '/trust-and-safety/disputes',
    category: 'Trust & Safety',
    tag: 'Disputes'
  },
  {
    title: 'Visual Task Proof Guide & Examples',
    description: 'Guidelines on uncropped screenshot formats, profile usernames, and avoiding proof rejections.',
    to: '/task-proof',
    category: 'Workers',
    tag: 'Proof Guide'
  },
  {
    title: 'How to Complete Micro-Tasks Successfully',
    description: 'Learn step-by-step instructions on discovering gigs, capturing valid proof, and earning verified rewards.',
    to: '/knowledge-base/how-to-complete-micro-tasks',
    category: 'Workers',
    tag: 'Worker Guide'
  },
  {
    title: 'How to Create a Micro-Task Campaign',
    description: 'Step-by-step walkthrough of campaign publishing, task requirements, escrow budget, and proof review.',
    to: '/knowledge-base/how-to-create-a-campaign',
    category: 'Advertisers',
    tag: 'Advertiser Setup'
  }
];

interface FAQCategoryItem {
  category: 'tasks' | 'advertisers' | 'escrow' | 'payments' | 'account';
  question: string;
  answer: string;
}

const defaultComprehensiveFaqs: FAQCategoryItem[] = [
  {
    category: 'tasks',
    question: "What is SmartExn and how does it work?",
    answer: "SmartExn is a global crowdsourced marketplace connecting workers who want to complete online tasks, surveys, and gigs with businesses and creators who need fast, verified social and digital engagement."
  },
  {
    category: 'tasks',
    question: "How do I complete online micro-tasks and submit proof?",
    answer: "Browse available tasks from your dashboard, carefully read the step-by-step instructions, complete the required steps (such as following a channel, testing an app, or taking a survey), and upload the required proof (such as screenshots, profile handles, or confirmation codes)."
  },
  {
    category: 'tasks',
    question: "When are my task rewards credited?",
    answer: "Once you submit your proof, the campaign creator reviews your submission within the allocated review window (typically 24 to 72 hours). Upon approval, funds are immediately credited to your Task Earnings wallet."
  },
  {
    category: 'tasks',
    question: "Are earnings guaranteed on SmartExn?",
    answer: "No. Earnings depend on task availability, worker accuracy, campaign requirements, and advertiser verification. SmartExn does not promise fixed or passive hourly income."
  },
  {
    category: 'advertisers',
    question: "How do businesses and advertisers create task campaigns?",
    answer: "Advertisers deposit funds into their Campaign Wallet, specify clear title, description, step-by-step instructions, required proof fields, and total available worker slots. Once launched, workers start executing the campaign immediately."
  },
  {
    category: 'advertisers',
    question: "What control do advertisers have over worker submissions?",
    answer: "Advertisers have full control to inspect all submitted proofs, view attached screenshots, and approve or reject submissions based on whether the worker followed the specified instructions."
  },
  {
    category: 'advertisers',
    question: "What happens if an advertiser cancels a campaign?",
    answer: "When an active campaign is cancelled or stopped, all remaining unspent escrow funds are immediately refunded back to the advertiser's Campaign Wallet."
  },
  {
    category: 'escrow',
    question: "What is Campaign Escrow and how does it protect users?",
    answer: "Campaign Escrow locks the campaign's total budget upon creation. This guarantees that workers will be paid upon accurate completion, while ensuring advertisers only pay for verified, authentic submissions."
  },
  {
    category: 'escrow',
    question: "What happens if a worker's submission is rejected?",
    answer: "If a worker believes their proof was rejected by mistake, they can open a Level-1 direct dispute with the campaign creator. If unresolved, it can be escalated to Level-2 admin arbitration for a neutral verdict."
  },
  {
    category: 'payments',
    question: "What is the difference between the Campaign Wallet and Task Earnings Wallet?",
    answer: "The Campaign Wallet is used by advertisers to fund task escrow budgets. The Task Earnings Wallet holds all approved rewards earned by completing tasks, which can be withdrawn or transferred according to platform rules."
  },
  {
    category: 'payments',
    question: "Which withdrawal methods and currencies are supported?",
    answer: "SmartExn supports multi-currency accounts (USD, EUR, PKR) with withdrawals available through local mobile wallets (EasyPaisa, JazzCash), cryptocurrency (USDT TRC20), and international payment channels."
  },
  {
    category: 'payments',
    question: "How long do withdrawal requests take to process?",
    answer: "Standard withdrawal requests undergo routine security and anti-fraud verification, typically processing within 12 to 48 hours."
  },
  {
    category: 'account',
    question: "Can I use multiple accounts on SmartExn?",
    answer: "No. Strict anti-fraud rules prohibit multiple accounts, automated bot scripts, or fake proof submissions. Violations lead to immediate account suspension and balance forfeiture."
  },
  {
    category: 'account',
    question: "How can I reach customer support if I need assistance?",
    answer: "You can submit an inquiry through our contact desk at support@smartexn.com or use the real-time floating WhatsApp support widget available on the website."
  }
];

const FaqPage: React.FC = () => {
    const { state } = useData();
    const { settings } = state;
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    // Merge system settings FAQs with comprehensive defaults
    const combinedFaqs = useMemo(() => {
        const customFaqs = (settings.faqs || []).map(f => ({
            category: 'tasks' as const,
            question: f.question,
            answer: f.answer
        }));

        // Use custom FAQs if configured, otherwise full knowledge base
        if (customFaqs.length > 0) {
            return [...customFaqs, ...defaultComprehensiveFaqs.filter(df => !customFaqs.some(cf => cf.question.toLowerCase() === df.question.toLowerCase()))];
        }
        return defaultComprehensiveFaqs;
    }, [settings.faqs]);

    const filteredFaqs = useMemo(() => {
        return combinedFaqs.filter(f => {
            const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
            const matchesSearch = !searchTerm || 
                f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                f.answer.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [combinedFaqs, selectedCategory, searchTerm]);

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": "https://smartexn.com/faqs#faq",
        "mainEntity": filteredFaqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f.answer
            }
        }))
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200 flex flex-col">
            <SEOHead 
                title="SmartExn FAQs: Payout Methods, Task Rules & Account Help"
                description="Find answers to frequently asked questions about SmartExn online micro-tasks, proof submissions, campaign creation, escrow safety, and withdrawals."
                canonical="https://smartexn.com/faqs"
                robots="index, follow"
                schemaJson={faqSchema}
            />

            <PublicNavHeader activePage="faqs" />

            <main className="max-w-4xl mx-auto px-4 py-12 flex-1">
                {/* Hero / Header */}
                <div className="text-center mb-12">
                    <span className="text-xs font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-3.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
                        Help & Support Knowledge Base
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-4 text-gray-900 dark:text-white">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mt-3">
                        Everything you need to know about completing online micro-tasks, creating campaigns, escrow security, and withdrawals.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-8">
                    <input 
                        type="text" 
                        placeholder="Search questions (e.g., 'escrow', 'dispute', 'withdrawal', 'campaign')..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-5 pl-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 shadow-lg outline-none text-base font-medium"
                    />
                    <svg className="w-6 h-6 absolute left-4 top-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-5 text-gray-400 hover:text-gray-600 text-sm font-bold">
                            Clear
                        </button>
                    )}
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                    {[
                        { id: 'all', label: 'All Topics' },
                        { id: 'tasks', label: 'Micro-Tasks & Gigs' },
                        { id: 'advertisers', label: 'Campaigns & Advertisers' },
                        { id: 'escrow', label: 'Escrow & Disputes' },
                        { id: 'payments', label: 'Payments & Withdrawals' },
                        { id: 'account', label: 'Account & Security' }
                    ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setSelectedCategory(cat.id); setExpandedIndex(null); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                selectedCategory === cat.id
                                    ? 'bg-sky-600 text-white shadow-md'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* FAQ List Accordion */}
                <div className="space-y-4">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => {
                            const isOpen = expandedIndex === index;
                            return (
                                <div 
                                    key={index} 
                                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/80 overflow-hidden shadow-sm hover:shadow-md transition-all"
                                >
                                    <button
                                        onClick={() => {
                                            const nextState = !isOpen;
                                            setExpandedIndex(nextState ? index : null);
                                            if (nextState) {
                                                seoAnalytics.trackFaqOpen(faq.question, '/faqs');
                                            }
                                        }}
                                        className="w-full p-6 text-left flex items-start justify-between gap-4 font-bold text-gray-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <span className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 text-sm font-black flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-800">
                                                {index + 1}
                                            </span>
                                            <h2 className="text-lg font-bold leading-snug pt-0.5">
                                                {faq.question}
                                            </h2>
                                        </div>
                                        <span className="text-xl text-sky-600 dark:text-sky-400 font-bold shrink-0 ml-2">
                                            {isOpen ? '−' : '+'}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="px-6 pb-6 text-gray-600 dark:text-gray-300 text-base leading-relaxed border-t border-gray-100 dark:border-gray-700/60 pt-4 pl-18">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">No matching questions found</h3>
                            <p className="text-gray-500 mt-1 text-sm">Try searching for different terms like "escrow", "proof", or "campaign".</p>
                            <Button variant="secondary" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }} className="mt-6 rounded-xl font-bold text-xs">
                                Reset Filters
                            </Button>
                        </div>
                    )}
                </div>

                {/* Related Educational Guides */}
                <div className="pt-12">
                    <RelatedGuides guides={relatedFaqGuides} />
                </div>

                {/* Bottom Support Card */}
                <div className="mt-16 p-8 sm:p-10 bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 rounded-3xl text-white text-center shadow-xl relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Still have questions?</h2>
                        <p className="text-sky-200 text-sm sm:text-base max-w-xl mx-auto">
                            Our support desk is available to assist you with tasks, campaigns, withdrawals, and account verification.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                            <a 
                                href="mailto:support@smartexn.com" 
                                className="px-6 py-3 bg-white text-slate-900 hover:bg-sky-50 rounded-xl font-bold text-sm shadow-md transition-all inline-flex items-center justify-center gap-2"
                            >
                                <span>Email Support</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            </a>
                            <Button 
                                variant="secondary" 
                                onClick={() => {
                                    seoAnalytics.trackRegisterCtaClick('/faqs', 'trust');
                                    navigate('/register');
                                }} 
                                className="px-6 py-3 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 text-white border-none shadow-md"
                            >
                                Create Free Account
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
};

export default FaqPage;
