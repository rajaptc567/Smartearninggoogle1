import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { SEOHead } from './SEOHead';
import { MobileStickyActionBar } from './MobileStickyActionBar';
import { seoAnalytics } from '../services/seoAnalytics';

interface SmartexnLandingPageProps {
  onOpenPolicy?: (policy: 'privacy' | 'refund' | 'terms' | 'faq' | 'about' | 'contact') => void;
}

// Payment Brand Vector Badges for 100% resilient rendering without external CDN failures
const PaymentBrandIcon: React.FC<{ name: string }> = ({ name }) => {
  const normalized = name.toLowerCase();

  if (normalized.includes('easypaisa')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
          <span className="text-white font-black text-xs tracking-tighter">ep</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 mt-1">EasyPaisa</span>
      </div>
    );
  }

  if (normalized.includes('jazzcash') || normalized.includes('jazz')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
          <span className="text-slate-950 font-black text-xs tracking-tighter">JC</span>
        </div>
        <span className="text-[10px] font-bold text-amber-400 mt-1">JazzCash</span>
      </div>
    );
  }

  if (normalized.includes('usdt') || normalized.includes('tether') || normalized.includes('crypto')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center shadow-md">
          <span className="text-white font-black text-xs">₮</span>
        </div>
        <span className="text-[10px] font-bold text-teal-300 mt-1">USDT TRC20</span>
      </div>
    );
  }

  if (normalized.includes('mastercard') || normalized.includes('visa')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center -space-x-2">
          <div className="w-6 h-6 rounded-full bg-red-500 opacity-90"></div>
          <div className="w-6 h-6 rounded-full bg-amber-400 opacity-90"></div>
        </div>
        <span className="text-[10px] font-bold text-sky-200 mt-1">Visa / MC</span>
      </div>
    );
  }

  if (normalized.includes('paypal')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
          <span className="text-white font-black text-xs italic">P</span>
        </div>
        <span className="text-[10px] font-bold text-blue-300 mt-1">PayPal</span>
      </div>
    );
  }

  if (normalized.includes('perfect')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-md">
          <span className="text-white font-black text-xs">PM</span>
        </div>
        <span className="text-[10px] font-bold text-red-300 mt-1">Perfect Money</span>
      </div>
    );
  }

  if (normalized.includes('payeer')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-md">
          <span className="text-slate-950 font-black text-xs">P</span>
        </div>
        <span className="text-[10px] font-bold text-sky-300 mt-1">Payeer</span>
      </div>
    );
  }

  if (normalized.includes('bank')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3l9-7z" />
          </svg>
        </div>
        <span className="text-[10px] font-bold text-slate-300 mt-1">Bank Wire</span>
      </div>
    );
  }

  if (normalized.includes('binance') || normalized.includes('bnb')) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-md">
          <span className="text-slate-950 font-black text-xs font-mono">BNB</span>
        </div>
        <span className="text-[10px] font-bold text-amber-300 mt-1">Binance</span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-lg sm:text-xl">
      💳
    </div>
  );
};

const SmartexnPaymentCard: React.FC<{ pm: { name: string; logoUrl?: string }; colorStyle: string }> = ({ pm, colorStyle }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`bg-[#0a1e36] border border-sky-500/20 hover:border-sky-400/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between w-32 h-32 sm:w-40 sm:h-40 shrink-0 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 group ${colorStyle === 'grayscale' ? 'grayscale hover:grayscale-0' : ''}`}>
      <div className="w-full flex-1 flex items-center justify-center p-1.5 overflow-hidden">
        {pm.logoUrl && !imgError ? (
          <img 
            src={pm.logoUrl} 
            alt={`${pm.name} Payment Method`} 
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="max-h-12 sm:max-h-16 max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300" 
            title={pm.name} 
            loading="lazy"
            decoding="async"
            width="120"
            height="50"
          />
        ) : (
          <PaymentBrandIcon name={pm.name} />
        )}
      </div>
      <div className="w-full pt-2 border-t border-sky-900/40 text-center">
        <span className="text-[11px] sm:text-xs font-bold text-sky-200 tracking-wide uppercase truncate block">
          {pm.name}
        </span>
      </div>
    </div>
  );
};

export const SmartexnLandingPage: React.FC<SmartexnLandingPageProps> = ({ onOpenPolicy }) => {
  const navigate = useNavigate();
  const { state } = useData();
  const { currentUser, settings } = state;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  const siteName = settings?.seoTitle?.split('-')[0]?.trim() || 'SmartExn.com';
  const sc = settings?.homepageContent?.smartexnContent || {};

  // Payment Partners Display Options from Admin Settings
  const showPaymentMethods = settings?.homepageContent?.showPaymentMethods !== false;
  const paymentMethodsTitle = settings?.homepageContent?.paymentMethodsTitle || "Global Payment & Withdrawal Partners";
  const paymentMethodsDesc = settings?.homepageContent?.paymentMethodsDesc || "Fast, secure deposits & instant withdrawals supported through top global networks, local e-wallets, and cryptocurrency channels.";
  const pmDisplayType = (settings?.homepageContent as any)?.paymentMethodsDisplayType || 'static';
  const pmColorStyle = (settings?.homepageContent as any)?.paymentMethodsColorStyle || 'color';

  const defaultPaymentLogos = useMemo(() => [
    { name: 'EasyPaisa', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Easypaisa_logo.png/320px-Easypaisa_logo.png' },
    { name: 'JazzCash', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Jazzcash_logo.png/320px-Jazzcash_logo.png' },
    { name: 'USDT (TRC20)', logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { name: 'Visa / MasterCard', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg' },
    { name: 'PayPal', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' },
    { name: 'Perfect Money', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Perfect_Money_logo.png' },
    { name: 'Payeer', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Payeer_logo.png' },
    { name: 'Bank Transfer', logoUrl: '' }
  ], []);

  const activePaymentMethods = useMemo(() => {
    if (settings?.homepagePaymentLogos && settings.homepagePaymentLogos.length > 0) {
      return settings.homepagePaymentLogos;
    }
    return defaultPaymentLogos;
  }, [settings?.homepagePaymentLogos, defaultPaymentLogos]);

  const slidingMethods = useMemo(() => {
    if (activePaymentMethods.length === 0) return [];
    if (activePaymentMethods.length < 10) {
      return [...activePaymentMethods, ...activePaymentMethods, ...activePaymentMethods, ...activePaymentMethods];
    }
    return [...activePaymentMethods, ...activePaymentMethods];
  }, [activePaymentMethods]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Structured FAQ Data for Schema and DOM
  const homepageFaqs = [
    {
      q: "What is SmartExn?",
      a: "SmartExn is a global online marketplace where users complete micro-tasks, surveys, and digital gigs for rewards, while businesses and advertisers access a verified crowdsourced workforce to promote campaigns."
    },
    {
      q: "How do online micro-tasks and gigs work?",
      a: "Workers browse available tasks, review clear step-by-step instructions, execute the required actions (such as social engagement, app feedback, or surveys), and submit verifiable proof. Once the campaign creator verifies the submission, rewards are credited."
    },
    {
      q: "How does Campaign Escrow protect workers and advertisers?",
      a: "When an advertiser launches a campaign, the total reward budget is held securely in platform escrow. When workers complete tasks accurately, rewards are guaranteed upon approval. If a campaign is cancelled, any remaining unspent escrow budget is safely refunded to the advertiser."
    },
    {
      q: "What happens if a task submission is mistakenly rejected?",
      a: "SmartExn features a fair two-level dispute desk. Workers can request Level-1 review directly with the campaign creator, or escalate to Level-2 admin arbitration for impartial verification."
    },
    {
      q: "How do withdrawals work and what gateways are supported?",
      a: "Workers can withdraw approved task earnings via supported gateways including EasyPaisa, JazzCash, USDT (TRC20), bank transfer, and international payment methods according to platform verification rules."
    },
    {
      q: "Are earnings or income guaranteed on SmartExn?",
      a: "No. Earnings vary depending on task availability, campaign requirements, completion quality, and advertiser verification. SmartExn does not promise fixed or passive hourly income."
    }
  ];

  const homepageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://smartexn.com/#website",
        "url": "https://smartexn.com/",
        "name": "SmartExn",
        "description": "Online micro-tasks, surveys, gigs, and global crowdsourcing platform.",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://smartexn.com/faqs?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://smartexn.com/#faq",
        "mainEntity": homepageFaqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      }
    ]
  };

  return (
    <div className="bg-[#0e2742] text-white min-h-screen font-sans selection:bg-blue-500 selection:text-white">
      <SEOHead 
        title="SmartExn | Online Micro-Tasks, Surveys & Global Gigs"
        description="Complete online micro-tasks, surveys and gigs on SmartExn, submit proof and earn rewards when approved. Businesses can create campaigns and reach a global task-based workforce."
        canonical="https://smartexn.com/"
        robots="index, follow"
        schemaJson={homepageSchema}
      />

      {/* --- TOP NAVBAR --- */}
      <header className="bg-[#0b1e36] border-b border-blue-900/40 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-white flex items-center gap-0.5">
                  Smart<span className="text-sky-400">Exn</span><span className="text-amber-400 text-lg">.com</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest text-sky-300/70 font-semibold -mt-1">
                  Global Micro Task Network
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium text-slate-200">
              <button onClick={() => navigate('/how-it-works')} className="hover:text-sky-400 transition-colors">
                How It Works
              </button>
              <button onClick={() => navigate('/micro-tasks')} className="hover:text-sky-400 transition-colors">
                Micro-Tasks
              </button>
              <button onClick={() => navigate('/paid-surveys')} className="hover:text-sky-400 transition-colors">
                Paid Surveys
              </button>
              <button onClick={() => navigate('/advertise')} className="hover:text-sky-400 transition-colors">
                For Advertisers
              </button>
              <button onClick={() => navigate('/faqs')} className="hover:text-sky-400 transition-colors">
                FAQs & Help
              </button>
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              {currentUser ? (
                <button
                  onClick={() => navigate('/member')}
                  className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md transition-all duration-200 active:scale-95"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-5 py-2 rounded-lg border border-sky-500/50 hover:bg-sky-500/10 text-sky-300 font-semibold text-sm transition-all"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="px-5 py-2 rounded-lg bg-[#c9a24b] hover:bg-[#b8913b] text-slate-900 font-bold text-sm shadow-lg hover:shadow-amber-500/20 transition-all duration-200 active:scale-95"
                  >
                    Sign Up - Free
                  </button>
                </>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-800/80 text-slate-200 hover:text-white border border-slate-700 focus:outline-none"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#08182a] border-b border-blue-900/60 px-4 pt-3 pb-6 space-y-2 animate-fade-in max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/how-it-works');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              How It Works
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/how-it-works-for-workers');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Guide for Workers
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/micro-tasks');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Online Micro-Tasks
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/paid-surveys');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Paid Surveys
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/task-proof');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Task Proof Guide
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/knowledge-base');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-sky-400 hover:bg-sky-950/50 text-base font-medium"
            >
              Knowledge Base Hub
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/advertise');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              For Advertisers
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/campaigns');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Crowdsourced Campaigns
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/trust-and-safety');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Trust & Safety
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/faqs');
              }}
              className="block w-full text-left py-2 px-3 rounded-lg text-slate-200 hover:bg-sky-950/50 text-base font-medium"
            >
              Knowledge Base & FAQs
            </button>

            <div className="pt-2 flex flex-col gap-2">
              {currentUser ? (
                <button
                  onClick={() => navigate('/member')}
                  className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-center shadow-md"
                >
                  Go to Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-2.5 rounded-lg border border-sky-500/50 text-sky-300 font-semibold text-center"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full py-2.5 rounded-lg bg-[#c9a24b] text-slate-900 font-bold text-center shadow-md"
                  >
                    Sign Up - Free
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* --- MAIN CONTENT LANDMARK --- */}
      <main id="main-content" className="w-full">

      {/* --- HERO SECTION --- */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-24 overflow-hidden bg-gradient-to-b from-[#0b1e36] via-[#0e2742] to-[#12355b]">
        {/* Ambient background blur elements with strict layout containment */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none contain-strict" aria-hidden="true"></div>
        <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none contain-strict" aria-hidden="true"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Hero Text */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-sky-500/10 border border-sky-400/40 rounded-full text-sky-200 font-semibold text-xs uppercase tracking-wider">
                <span>⚡ Global Crowdsourced Task & Gig Marketplace</span>
              </div>

              {/* Single Semantic H1 Element */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                {sc.heroTitle || (
                  <>Earn Rewards with Online <span className="text-sky-400">Micro-Tasks</span>, Surveys & Gigs</>
                )}
              </h1>

              <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                {sc.heroSubtitle || "Complete available online tasks, surveys and gigs, submit the required proof, and earn rewards when your work is approved. Businesses can also create campaigns and reach a global task-based workforce."}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <div className="w-full sm:w-auto text-center sm:text-left">
                  <button
                    onClick={() => {
                      seoAnalytics.trackWorkerCtaClick('Start Earning (Hero)', '/');
                      navigate('/register');
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#1d5c8d] hover:bg-[#164a73] text-white font-bold text-base shadow-xl shadow-sky-900/30 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>{sc.heroStartBtn || "Start Earning"}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </button>
                  <span className="block text-[11px] text-sky-200 mt-1.5 font-medium">Free to create an account</span>
                </div>

                <div className="w-full sm:w-auto text-center sm:text-left">
                  <button
                    onClick={() => {
                      seoAnalytics.trackAdvertiserCtaClick('Create a Campaign (Hero)', '/');
                      if (currentUser) {
                        navigate('/member/create-campaign');
                      } else {
                        navigate('/register');
                      }
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#caa14e] hover:bg-[#b8913d] text-slate-950 font-bold text-base shadow-xl hover:shadow-amber-500/10 transition-all transform active:scale-95"
                  >
                    {sc.heroPublishBtn || "Create a Campaign"}
                  </button>
                  <span className="block text-[11px] text-amber-200 mt-1.5 font-medium">Reach verified crowdsourced workers</span>
                </div>
              </div>

              {/* Trust signals mini-row */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> 100% Escrow Protected
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">✓</span> Fast Proof Verification
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span> Multi-Currency Payouts
                </div>
              </div>
            </div>

            {/* Hero Vector Banner Illustration */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md lg:max-w-none bg-gradient-to-br from-slate-800/40 to-slate-900/60 p-6 md:p-8 rounded-3xl border border-sky-500/20 shadow-2xl backdrop-blur-sm">
                <svg viewBox="0 0 500 380" className="w-full h-auto drop-shadow-xl" xmlns="http://www.w3.org/2000/svg" width="500" height="380">
                  <defs>
                    <linearGradient id="bgGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="laptopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.3" />
                    </filter>
                  </defs>

                  {/* Backdrop Shape */}
                  <rect x="20" y="20" width="460" height="340" rx="24" fill="url(#bgGlow)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 6" />

                  {/* Earner Avatars with Laptops */}
                  {/* Left Avatar */}
                  <g filter="url(#shadow)">
                    <circle cx="120" cy="180" r="28" fill="#38bdf8" />
                    <path d="M120 155 a12 12 0 0 1 12 12 v8 a12 12 0 0 1 -24 0 v-8 a12 12 0 0 1 12 -12" fill="#f8fafc" />
                    <rect x="85" y="210" width="70" height="42" rx="6" fill="url(#laptopGrad)" stroke="#0284c7" strokeWidth="1.5" />
                    <path d="M80 252 h80 v4 a2 2 0 0 1 -2 2 h-76 a2 2 0 0 1 -2 -2 z" fill="#64748b" />
                  </g>

                  {/* Center Main Earner */}
                  <g filter="url(#shadow)">
                    <circle cx="250" cy="220" r="32" fill="#0284c7" />
                    <path d="M250 192 a14 14 0 0 1 14 14 v10 a14 14 0 0 1 -28 0 v-10 a14 14 0 0 1 14 -14" fill="#f8fafc" />
                    <rect x="210" y="255" width="80" height="48" rx="6" fill="url(#laptopGrad)" stroke="#38bdf8" strokeWidth="2" />
                    <path d="M200 303 h100 v6 a2 2 0 0 1 -2 2 h-96 a2 2 0 0 1 -2 -2 z" fill="#94a3b8" />
                  </g>

                  {/* Right Avatar */}
                  <g filter="url(#shadow)">
                    <circle cx="380" cy="190" r="28" fill="#818cf8" />
                    <path d="M380 165 a12 12 0 0 1 12 12 v8 a12 12 0 0 1 -24 0 v-8 a12 12 0 0 1 12 -12" fill="#f8fafc" />
                    <rect x="345" y="220" width="70" height="42" rx="6" fill="url(#laptopGrad)" stroke="#6366f1" strokeWidth="1.5" />
                    <path d="M340 262 h80 v4 a2 2 0 0 1 -2 2 h-76 a2 2 0 0 1 -2 -2 z" fill="#64748b" />
                  </g>

                  {/* Floating Task Cards & Badges */}
                  <g filter="url(#shadow)">
                    <rect x="40" y="45" width="100" height="85" rx="12" fill="#ffffff" />
                    <rect x="52" y="60" width="12" height="12" rx="3" fill="#38bdf8" />
                    <path d="M55 66 l2 2 l4 -4" stroke="#ffffff" strokeWidth="2" fill="none" />
                    <line x1="72" y1="66" x2="125" y2="66" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                    
                    <rect x="52" y="80" width="12" height="12" rx="3" fill="#38bdf8" />
                    <path d="M55 86 l2 2 l4 -4" stroke="#ffffff" strokeWidth="2" fill="none" />
                    <line x1="72" y1="86" x2="120" y2="86" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />

                    <rect x="52" y="100" width="12" height="12" rx="3" fill="#38bdf8" />
                    <path d="M55 106 l2 2 l4 -4" stroke="#ffffff" strokeWidth="2" fill="none" />
                    <line x1="72" y1="106" x2="110" y2="106" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                  </g>

                  {/* Center Star & Golden Coins */}
                  <g filter="url(#shadow)">
                    <circle cx="250" cy="70" r="22" fill="#eab308" />
                    <text x="250" y="76" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="bold">★</text>
                  </g>

                  <g filter="url(#shadow)">
                    <circle cx="300" cy="95" r="16" fill="#f59e0b" />
                    <text x="300" y="100" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">$</text>
                  </g>

                  {/* Earn Pill Badge Top Right */}
                  <g filter="url(#shadow)">
                    <rect x="360" y="55" width="95" height="38" rx="19" fill="#0284c7" />
                    <text x="407" y="79" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">★ Earn</text>
                  </g>
                </svg>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS SECTION --- */}
      <section id="how-it-works" className="py-16 md:py-24 bg-[#eef5fb] text-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-sky-900 bg-sky-100 px-3.5 py-1 rounded-full border border-sky-300">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              {sc.howItWorksTitle || "How SmartExn Works"}
            </h2>
            <p className="text-slate-700 mt-2 text-sm sm:text-base">
              A transparent, escrow-backed workflow connecting task workers with campaign creators.
            </p>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white font-extrabold text-xl flex items-center justify-center mb-4 shadow-md">
                  1
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {sc.step1Title || "Sign Up for Free"}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {sc.step1Desc || "Create your free account as an earner or advertiser in less than a minute."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-sky-800 mt-4 block">Zero registration fees</span>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white font-extrabold text-xl flex items-center justify-center mb-4 shadow-md">
                  2
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {sc.step2Title || "Choose Projects"}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {sc.step2Desc || "Browse available social tasks, surveys, app feedback gigs, and data tagging opportunities."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-sky-800 mt-4 block">Clear instructions & rewards</span>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white font-extrabold text-xl flex items-center justify-center mb-4 shadow-md">
                  3
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {sc.step3Title || "Complete & Submit Proof"}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {sc.step3Desc || "Follow the exact steps and upload verification proofs (screenshots, usernames, or answers)."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-sky-800 mt-4 block">Escrow-backed reward protection</span>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white font-extrabold text-xl flex items-center justify-center mb-4 shadow-md">
                  4
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {sc.step4Title || "Get Paid & Withdraw"}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {sc.step4Desc || "Receive rewards in your Task Earnings wallet and withdraw via supported payment gateways."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-sky-800 mt-4 block">Fast processing & low minimums</span>
            </div>

          </div>
        </div>
      </section>

      {/* --- FEATURED EARNING OPPORTUNITIES --- */}
      <section id="earning-opportunities" className="py-16 md:py-24 bg-[#0a1e36] text-white border-t border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-sky-300 bg-sky-950/80 px-3.5 py-1 rounded-full border border-sky-800">
              Versatile Earning Categories
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              {sc.oppsTitle || "Featured Earning Opportunities"}
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Choose from a variety of legitimate micro-tasks and surveys matched to your skills and devices.
            </p>
          </div>

          {/* 4 Opportunities Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Opportunity 1 */}
            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/50 shadow-lg hover:shadow-xl transition-all">
              <div className="text-3xl p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 w-fit mb-4">
                📝
              </div>
              <h3 className="font-bold text-white text-lg mb-2">
                {sc.opp1Title || "Paid Surveys & Opinion Studies"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sc.opp1Desc || "Share your feedback on consumer products, test interactive questionnaires, and earn upon successful completion."}
              </p>
            </div>

            {/* Opportunity 2 */}
            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/50 shadow-lg hover:shadow-xl transition-all">
              <div className="text-3xl p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 w-fit mb-4">
                👍
              </div>
              <h3 className="font-bold text-white text-lg mb-2">
                {sc.opp2Title || "Social Media Engagement"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sc.opp2Desc || "Follow YouTube channels, like posts, engage with TikTok videos, and promote verified creator campaigns."}
              </p>
            </div>

            {/* Opportunity 3 */}
            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/50 shadow-lg hover:shadow-xl transition-all">
              <div className="text-3xl p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-sky-400 w-fit mb-4">
                📱
              </div>
              <h3 className="font-bold text-white text-lg mb-2">
                {sc.opp3Title || "App Testing & Reviews"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sc.opp3Desc || "Install mobile applications, explore gameplay features, report usability feedback, and claim rewards."}
              </p>
            </div>

            {/* Opportunity 4 */}
            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 hover:border-sky-400/50 shadow-lg hover:shadow-xl transition-all">
              <div className="text-3xl p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 w-fit mb-4">
                💻
              </div>
              <h3 className="font-bold text-white text-lg mb-2">
                {sc.opp4Title || "Data Entry & Micro-Jobs"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sc.opp4Desc || "Perform website visits, image categorization, transcription snippet tasks, and small digital gigs."}
              </p>
            </div>

          </div>

          {/* Responsible earnings disclosure */}
          <div className="p-4 bg-sky-950/60 rounded-2xl border border-sky-800/60 text-center text-xs text-sky-200 max-w-3xl mx-auto">
            <span className="font-bold text-sky-300">Earnings Disclosure:</span> Earnings vary depending on task availability, requirements, completion quality, and advertiser verification. SmartExn does not guarantee fixed or passive hourly income.
          </div>

        </div>
      </section>

      {/* --- BUSINESS & ADVERTISERS SECTION --- */}
      <section id="advertisers" className="py-16 md:py-24 bg-[#eef5fb] text-slate-800 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-sky-900 bg-sky-100 px-3.5 py-1 rounded-full border border-sky-300">
                Advertiser & Campaign Solutions
              </span>
              <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                {sc.bizTitle || "For Businesses & Campaign Creators"}
              </h2>
            </div>
            <button
              onClick={() => {
                seoAnalytics.trackAdvertiserCtaClick('Post a Campaign Now (Advertisers Section)', '/');
                if (currentUser) {
                  navigate('/member/create-campaign');
                } else {
                  navigate('/register');
                }
              }}
              className="px-6 py-3 bg-[#1d5c8d] hover:bg-[#164a73] text-white rounded-xl font-bold text-sm shadow-md transition-all shrink-0"
            >
              Post a Campaign Now
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Feature 1 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-lg shrink-0">
                  🌍
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">
                    {sc.bizPoint1Title || "Access a Vast Global Workforce"}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {sc.bizPoint1Desc || "Reach thousands of real, authenticated workers ready to complete your custom social, mobile, or website tasks."}
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">
                    {sc.bizPoint2Title || "100% Escrow & Refund Protection"}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {sc.bizPoint2Desc || "Your campaign funds are securely held in escrow. Pay only for verified, approved worker proofs. Unused balances are refunded."}
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
                  📊
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">
                    {sc.bizPoint3Title || "Custom Instructions & Proof Auditing"}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {sc.bizPoint3Desc || "Specify exact requirements, define custom validation questions, and inspect proof screenshots before releasing payment."}
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg shrink-0">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">
                    {sc.bizPoint4Title || "Flexible Budgeting & Rapid Execution"}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {sc.bizPoint4Desc || "Launch campaigns starting with flexible slots, set custom worker reward rates, and achieve fast engagement."}
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* --- ESCROW & TASK PROTECTION SECTION --- */}
      <section id="escrow-protection" className="py-16 md:py-24 bg-[#0a1e36] text-white border-t border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/80 px-3.5 py-1 rounded-full border border-emerald-800">
              Security & Fairness Guaranteed
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              Platform Escrow & Dispute Protection
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              SmartExn eliminates payment uncertainty with an automated escrow layer and a fair arbitration desk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg">
                🔒
              </div>
              <h3 className="text-lg font-bold text-white">Guaranteed Escrow Lock</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When a campaign is published, the creator's budget is locked in escrow. Workers who complete the task as requested are guaranteed to receive their reward upon approval.
              </p>
            </div>

            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
                ⚖️
              </div>
              <h3 className="text-lg font-bold text-white">Two-Level Dispute Resolution</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                If a proof submission is incorrectly rejected, workers can initiate Level-1 review with the creator or escalate to Level-2 admin arbitration for impartial verification.
              </p>
            </div>

            <div className="bg-[#0e2742] p-6 rounded-2xl border border-sky-500/20 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                🔄
              </div>
              <h3 className="text-lg font-bold text-white">Unused Budget Refunds</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Advertisers who stop or cancel an active campaign receive an instant, transparent refund of all unspent escrow budget directly back to their Campaign Wallet.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* --- PAYMENT PARTNERS SECTION --- */}
      {showPaymentMethods && (
        <section className="py-14 md:py-20 bg-[#081728] border-t border-blue-900/50 relative overflow-hidden">
          <style>{`
            @keyframes slide-left-smartexn {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-slide-smartexn {
              animation: slide-left-smartexn 25s linear infinite;
            }
            .animate-slide-smartexn:hover {
              animation-play-state: paused;
            }
          `}</style>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-sky-500/10 border border-sky-400/30 rounded-full text-sky-300 font-semibold text-xs uppercase tracking-widest">
                ⚡ Supported Multi-Currency Payment Networks
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {paymentMethodsTitle}
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {paymentMethodsDesc}
              </p>
            </div>

            {/* Payment Partners Cards */}
            <div className="relative">
              {pmDisplayType === 'sliding' ? (
                <div className="overflow-hidden w-full py-4">
                  <div className="flex animate-slide-smartexn gap-4 sm:gap-6 items-center">
                    {slidingMethods.map((pm, idx) => (
                      <SmartexnPaymentCard key={`${pm.name}-${idx}`} pm={pm} colorStyle={pmColorStyle} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
                  {activePaymentMethods.map((pm, idx) => (
                    <div key={idx} className={pmDisplayType === 'pulsing' ? 'animate-pulse' : ''}>
                      <SmartexnPaymentCard pm={pm} colorStyle={pmColorStyle} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2 bg-[#0c223a] px-4 py-2.5 rounded-xl border border-sky-500/20 shadow-sm">
                <span className="text-emerald-400 font-bold">✓ Secure HTTPS</span> Encrypted Sessions
              </div>
              <div className="flex items-center gap-2 bg-[#0c223a] px-4 py-2.5 rounded-xl border border-sky-500/20 shadow-sm">
                <span className="text-sky-400 font-bold">⚡ Direct Deposit</span> Processing
              </div>
              <div className="flex items-center gap-2 bg-[#0c223a] px-4 py-2.5 rounded-xl border border-sky-500/20 shadow-sm">
                <span className="text-amber-400 font-bold">🚀 Multi-Gateway</span> Payout Support
              </div>
            </div>

          </div>
        </section>
      )}

      {/* --- HOMEPAGE FAQ ACCORDION SECTION --- */}
      <section id="faq-section" className="py-16 md:py-24 bg-[#eef5fb] text-slate-800 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-sky-900 bg-sky-100 px-3.5 py-1 rounded-full border border-sky-300">
              Got Questions?
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Learn more about completing tasks, creating campaigns, escrow protection, and payments.
            </p>
          </div>

          <div className="space-y-4">
            {homepageFaqs.map((faq, idx) => {
              const isOpen = activeFaqIndex === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => {
                      const nextState = !isOpen;
                      setActiveFaqIndex(nextState ? idx : null);
                      if (nextState) {
                        seoAnalytics.trackFaqOpen(faq.q, '/');
                      }
                    }}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 hover:text-sky-700 transition-colors"
                  >
                    <span className="text-base sm:text-lg">{faq.q}</span>
                    <span className="text-xl text-sky-700 shrink-0">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => navigate('/faqs')}
              className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Explore Complete Knowledge Base</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

        </div>
      </section>

      {/* --- FINAL CTA SECTION --- */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Join the Global Task Marketplace?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
            Whether you want to earn rewards completing tasks or promote your business with a global workforce, SmartExn provides the secure platform you need.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                seoAnalytics.trackWorkerCtaClick('Start Earning Now (Bottom CTA)', '/');
                navigate('/register');
              }}
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-900 hover:bg-sky-50 font-bold rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Start Earning Now
            </button>
            <button
              onClick={() => {
                seoAnalytics.trackAdvertiserCtaClick('Create a Campaign (Bottom CTA)', '/');
                if (currentUser) {
                  navigate('/member/create-campaign');
                } else {
                  navigate('/register');
                }
              }}
              className="w-full sm:w-auto px-8 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Create a Campaign
            </button>
          </div>
        </div>
      </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-[#091a2e] text-slate-300 pt-12 pb-24 lg:pb-12 border-t border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Footer Logo */}
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                Smart<span className="text-sky-400">Exn</span><span className="text-amber-400 text-lg">.com</span>
              </span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-300">
              <button onClick={() => navigate('/how-it-works')} className="hover:text-sky-400 transition-colors">
                How It Works
              </button>
              <button onClick={() => navigate('/how-it-works-for-workers')} className="hover:text-sky-400 transition-colors">
                For Workers
              </button>
              <button onClick={() => navigate('/micro-tasks')} className="hover:text-sky-400 transition-colors">
                Micro-Tasks
              </button>
              <button onClick={() => navigate('/paid-surveys')} className="hover:text-sky-400 transition-colors">
                Paid Surveys
              </button>
              <button onClick={() => navigate('/task-proof')} className="hover:text-sky-400 transition-colors">
                Task Proof Guide
              </button>
              <button onClick={() => navigate('/knowledge-base')} className="hover:text-sky-400 transition-colors font-semibold text-sky-400">
                Knowledge Base
              </button>
              <button onClick={() => navigate('/advertise')} className="hover:text-sky-400 transition-colors">
                For Advertisers
              </button>
              <button onClick={() => navigate('/campaigns')} className="hover:text-sky-400 transition-colors">
                Campaigns
              </button>
              <button onClick={() => navigate('/trust-and-safety')} className="hover:text-sky-400 transition-colors">
                Trust & Safety
              </button>
              <button onClick={() => navigate('/faqs')} className="hover:text-sky-400 transition-colors">
                FAQs
              </button>
              <button onClick={() => navigate('/terms-of-use')} className="hover:text-sky-400 transition-colors">
                Terms
              </button>
              <button onClick={() => navigate('/privacy-policy')} className="hover:text-sky-400 transition-colors">
                Privacy
              </button>
              <button onClick={() => navigate('/refund-policy')} className="hover:text-sky-400 transition-colors">
                Refunds
              </button>
              <button onClick={() => setShowContactModal(true)} className="hover:text-sky-400 transition-colors">
                Contact Support
              </button>
            </div>

            {/* Social Icons */}
            <div className="flex items-center space-x-5 text-slate-300">
              <a href="#facebook" onClick={(e) => e.preventDefault()} className="hover:text-sky-400 transition-colors text-lg" title="Facebook">
                f
              </a>
              <a href="#twitter" onClick={(e) => e.preventDefault()} className="hover:text-sky-400 transition-colors text-lg" title="Twitter">
                𝕏
              </a>
              <a href="#instagram" onClick={(e) => e.preventDefault()} className="hover:text-sky-400 transition-colors text-lg" title="Instagram">
                📷
              </a>
              <a href="#linkedin" onClick={(e) => e.preventDefault()} className="hover:text-sky-400 transition-colors text-lg" title="LinkedIn">
                in
              </a>
            </div>

          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
            <div>
              {sc.footerCopyright || `© 2023 ${siteName}. All rights reserved.`}
            </div>
            <div>
              SmartExn Global Micro-Task & Crowdsourcing Network
            </div>
          </div>

        </div>
      </footer>

      {/* --- CONTACT MODAL --- */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f2942] border border-sky-500/30 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-sky-900/60 pb-3">
              <h3 className="text-xl font-bold flex items-center gap-2">
                📬 Contact SmartExn Support
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm text-slate-300">
              <p>Have questions about micro-jobs, withdrawals, or advertising campaigns?</p>
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1">
                <p className="text-xs text-slate-400 font-semibold">Official Support Email:</p>
                <p className="font-bold text-sky-400">support@smartexn.com</p>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1">
                <p className="text-xs text-slate-400 font-semibold">WhatsApp Business Support:</p>
                <p className="font-bold text-emerald-400">{settings?.whatsappNumber || '+1 (800) 555-EXN'}</p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Only Sticky Conversion Action Bar */}
      <MobileStickyActionBar />

    </div>
  );
};

export default SmartexnLandingPage;
