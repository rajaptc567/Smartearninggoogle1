import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { SEOHead } from '../components/SEOHead';
import { PublicNavHeader } from '../components/PublicNavHeader';
import { PublicFooter } from '../components/PublicFooter';
import {
    defaultPrivacyPolicyTitle, defaultPrivacyPolicyUpdated, defaultPrivacyPolicyContent,
    defaultTermsOfUseTitle, defaultTermsOfUseUpdated, defaultTermsOfUseContent,
    defaultRefundPolicyTitle, defaultRefundPolicyUpdated, defaultRefundPolicyContent,
    defaultCookiePolicyTitle, defaultCookiePolicyUpdated, defaultCookiePolicyContent,
    defaultContactUsTitle, defaultContactUsUpdated, defaultContactUsContent,
    defaultAboutUsTitle, defaultAboutUsUpdated, defaultAboutUsContent,
    defaultAntiFraudPolicyTitle, defaultAntiFraudPolicyUpdated, defaultAntiFraudPolicyContent,
    defaultWithdrawalPolicyTitle, defaultWithdrawalPolicyUpdated, defaultWithdrawalPolicyContent,
    defaultDisclaimerTitle, defaultDisclaimerUpdated, defaultDisclaimerContent,
    defaultDmcaPolicyTitle, defaultDmcaPolicyUpdated, defaultDmcaPolicyContent
} from '../data/legalDefaults';

type GlobalPolicyTab = 'privacy' | 'terms' | 'cookie' | 'contact' | 'about' | 'antifraud' | 'withdrawal' | 'refund' | 'disclaimer' | 'dmca';

interface PrivacyPolicyProps {
    defaultTab?: GlobalPolicyTab;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ defaultTab }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { state } = useData();
    const { settings } = state;
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Determine tab based on pathname if direct route
    const derivedTab = useMemo<GlobalPolicyTab>(() => {
        const path = location.pathname.toLowerCase();
        if (path.includes('terms-of-use')) return 'terms';
        if (path.includes('refund-policy')) return 'refund';
        if (path.includes('privacy-policy')) return 'privacy';
        return (searchParams.get('tab') as GlobalPolicyTab) || defaultTab || 'privacy';
    }, [location.pathname, searchParams, defaultTab]);

    const [activeTab, setActiveTab] = useState<GlobalPolicyTab>(derivedTab);

    useEffect(() => {
        setActiveTab(derivedTab);
    }, [derivedTab]);

    const handleTabChange = (tab: GlobalPolicyTab) => {
        setActiveTab(tab);
        if (tab === 'privacy') navigate('/privacy-policy');
        else if (tab === 'terms') navigate('/terms-of-use');
        else if (tab === 'refund') navigate('/refund-policy');
        else {
            setSearchParams({ tab });
        }
    };

    const policies = {
        privacy: {
            title: settings.privacyPolicyTitle || defaultPrivacyPolicyTitle,
            updated: settings.privacyPolicyUpdated || defaultPrivacyPolicyUpdated,
            content: settings.privacyPolicyContent || defaultPrivacyPolicyContent,
            seoTitle: "SmartExn Privacy Policy | Data Protection & Security",
            seoDesc: "Read the official SmartExn Privacy Policy. Learn how task data, user profiles, and proof submissions are protected and securely handled.",
            canonical: "https://smartexn.com/privacy-policy",
            color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-500/10',
            badge: 'Privacy',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.013A11.959 11.959 0 0112 2.714z" />
                </svg>
            )
        },
        terms: {
            title: settings.termsOfUseTitle || defaultTermsOfUseTitle,
            updated: settings.termsOfUseUpdated || defaultTermsOfUseUpdated,
            content: settings.termsOfUseContent || defaultTermsOfUseContent,
            seoTitle: "SmartExn Terms of Use | Worker & Advertiser Rules",
            seoDesc: "Review the SmartExn Terms of Use governing online micro-task completion, campaign publishing, platform escrow, and account rules.",
            canonical: "https://smartexn.com/terms-of-use",
            color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-500/10',
            badge: 'Terms',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            )
        },
        refund: {
            title: settings.refundPolicyTitle || defaultRefundPolicyTitle,
            updated: settings.refundPolicyUpdated || defaultRefundPolicyUpdated,
            content: settings.refundPolicyContent || defaultRefundPolicyContent,
            seoTitle: "SmartExn Refund & Escrow Policy | Buyer & Worker Protection",
            seoDesc: "Understand SmartExn campaign escrow guarantees, unused budget refunds, and reward disbursement protection for task earners.",
            canonical: "https://smartexn.com/refund-policy",
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/10',
            badge: 'Escrow & Refunds',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        cookie: {
            title: settings.cookiePolicyTitle || defaultCookiePolicyTitle,
            updated: settings.cookiePolicyUpdated || defaultCookiePolicyUpdated,
            content: settings.cookiePolicyContent || defaultCookiePolicyContent,
            seoTitle: "SmartExn Cookie Policy | Platform Security & Privacy",
            seoDesc: "Learn how SmartExn uses necessary cookies for secure session authentication and anti-fraud protection.",
            canonical: "https://smartexn.com/privacy-policy?tab=cookie",
            color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500/10',
            badge: 'Cookies',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a9 9 0 1116.5 0" />
                </svg>
            )
        },
        contact: {
            title: settings.contactUsTitle || defaultContactUsTitle,
            updated: settings.contactUsUpdated || defaultContactUsUpdated,
            content: settings.contactUsContent || defaultContactUsContent,
            seoTitle: "Contact SmartExn Support | Helpdesk & Inquiries",
            seoDesc: "Get in touch with the SmartExn customer support team for inquiries about tasks, campaigns, withdrawals, or disputes.",
            canonical: "https://smartexn.com/privacy-policy?tab=contact",
            color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-500/10',
            badge: 'Contact',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.502-5.114-3.792-6.616-6.616l1.293-.97c.362-.271.527-.733.417-1.173L5.863 3.32a1.25 1.25 0 00-1.09-1.09H3.32c-.622 0-1.09.504-1.09 1.125V6.75z" />
                </svg>
            )
        },
        about: {
            title: settings.aboutUsTitle || defaultAboutUsTitle,
            updated: settings.aboutUsUpdated || defaultAboutUsUpdated,
            content: settings.aboutUsContent || defaultAboutUsContent,
            seoTitle: "About SmartExn | Global Micro-Task & Crowdsourcing Platform",
            seoDesc: "Discover the mission and architecture behind SmartExn, a global marketplace connecting micro-task earners with campaign creators.",
            canonical: "https://smartexn.com/privacy-policy?tab=about",
            color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-500/10',
            badge: 'About Us',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
            )
        },
        antifraud: {
            title: settings.antiFraudPolicyTitle || defaultAntiFraudPolicyTitle,
            updated: settings.antiFraudPolicyUpdated || defaultAntiFraudPolicyUpdated,
            content: settings.antiFraudPolicyContent || defaultAntiFraudPolicyContent,
            seoTitle: "SmartExn Anti-Fraud Policy | Quality & Integrity Rules",
            seoDesc: "Learn about SmartExn zero-tolerance fraud policy against duplicate accounts, fake proof submissions, and bot manipulation.",
            canonical: "https://smartexn.com/privacy-policy?tab=antifraud",
            color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-500/10',
            badge: 'Anti-Fraud',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
            )
        },
        withdrawal: {
            title: settings.withdrawalPolicyTitle || defaultWithdrawalPolicyTitle,
            updated: settings.withdrawalPolicyUpdated || defaultWithdrawalPolicyUpdated,
            content: settings.withdrawalPolicyContent || defaultWithdrawalPolicyContent,
            seoTitle: "SmartExn Withdrawal Policy | Payout Rules & Schedules",
            seoDesc: "Review SmartExn withdrawal terms, supported payout channels (EasyPaisa, JazzCash, USDT, Bank), and verification timelines.",
            canonical: "https://smartexn.com/privacy-policy?tab=withdrawal",
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/10',
            badge: 'Withdrawal',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5M5.25 7.5h13.5m-12 3h10.5m-12 3h12a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H5.25a2.25 2.25 0 00-2.25 2.25v3.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
            )
        },
        disclaimer: {
            title: settings.disclaimerTitle || defaultDisclaimerTitle,
            updated: settings.disclaimerUpdated || defaultDisclaimerUpdated,
            content: settings.disclaimerContent || defaultDisclaimerContent,
            seoTitle: "SmartExn Platform Disclaimer | General Information",
            seoDesc: "Read the official SmartExn platform disclaimer regarding earnings variability, campaign listings, and marketplace terms.",
            canonical: "https://smartexn.com/privacy-policy?tab=disclaimer",
            color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-500/10',
            badge: 'Disclaimer',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            )
        },
        dmca: {
            title: settings.dmcaPolicyTitle || defaultDmcaPolicyTitle,
            updated: settings.dmcaPolicyUpdated || defaultDmcaPolicyUpdated,
            content: settings.dmcaPolicyContent || defaultDmcaPolicyContent,
            seoTitle: "SmartExn DMCA & IP Policy | Copyright Infringement Notices",
            seoDesc: "Information on submitting DMCA copyright infringement notices and intellectual property takedown requests to SmartExn.",
            canonical: "https://smartexn.com/privacy-policy?tab=dmca",
            color: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-500/10',
            badge: 'DMCA',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
            )
        }
    };

    const activePolicy = policies[activeTab] || policies.privacy;

    const tabsList: { key: GlobalPolicyTab; label: string; badge: string; icon: React.ReactNode }[] = [
        { key: 'privacy', label: 'Privacy Policy', badge: 'Privacy', icon: policies.privacy.icon },
        { key: 'terms', label: 'Terms of Use', badge: 'Terms', icon: policies.terms.icon },
        { key: 'refund', label: 'Refund & Escrow Policy', badge: 'Escrow', icon: policies.refund.icon },
        { key: 'withdrawal', label: 'Withdrawal Policy', badge: 'Payouts', icon: policies.withdrawal.icon },
        { key: 'antifraud', label: 'Anti-Fraud Policy', badge: 'Anti-Fraud', icon: policies.antifraud.icon },
        { key: 'about', label: 'About Us', badge: 'About', icon: policies.about.icon },
        { key: 'contact', label: 'Contact Support', badge: 'Contact', icon: policies.contact.icon },
        { key: 'cookie', label: 'Cookie Policy', badge: 'Cookies', icon: policies.cookie.icon },
        { key: 'disclaimer', label: 'Disclaimer', badge: 'Disclaimer', icon: policies.disclaimer.icon },
        { key: 'dmca', label: 'DMCA & IP Notice', badge: 'DMCA', icon: policies.dmca.icon }
    ];

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200 flex flex-col">
            <SEOHead 
                title={activePolicy.seoTitle}
                description={activePolicy.seoDesc}
                canonical={activePolicy.canonical}
                robots="index, follow"
            />

            <PublicNavHeader activePage="legal" />

            <main className="container mx-auto px-4 md:px-8 py-8 md:py-12 max-w-7xl flex-1">
                {/* Visual Intro Banner */}
                <div className="relative bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 text-white rounded-3xl p-6 md:p-12 shadow-xl overflow-hidden mb-8 text-left">
                    <div className="relative z-10">
                        <span className="bg-sky-500/20 text-sky-300 font-extrabold uppercase tracking-widest text-[10px] px-3.5 py-1.5 rounded-full backdrop-blur-md inline-block mb-3 border border-sky-400/30">
                            SmartExn Trust & Compliance
                        </span>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">Legal & Compliance Center</h1>
                        <p className="text-sm md:text-base text-slate-300 max-w-2xl font-normal">
                            Review our official terms for micro-tasks, campaign publishing, platform escrow security, anti-fraud enforcement, and payouts.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Navigation Sidebar */}
                    <div className="lg:col-span-1 space-y-2">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4 shadow-sm text-left">
                            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 mb-3">Policies & Frameworks</h2>
                            <div className="space-y-1">
                                {tabsList.map(tab => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => handleTabChange(tab.key)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                                                isActive 
                                                    ? 'bg-sky-600 text-white shadow-md' 
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className={isActive ? 'text-white' : 'text-gray-400'}>{tab.icon}</span>
                                                <span className="truncate">{tab.label}</span>
                                            </div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                            }`}>
                                                {tab.badge}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Viewer */}
                    <div className="lg:col-span-3 text-left">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 md:p-12 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-600"></div>
                            
                            <div className="mb-8 pb-6 border-b dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-md border ${activePolicy.color}`}>
                                        {activePolicy.badge}
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">
                                    {activePolicy.title}
                                </h2>
                                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    {activePolicy.updated}
                                </p>
                            </div>

                            <div className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm md:text-base whitespace-pre-line font-normal space-y-4">
                                {activePolicy.content}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
};

export default PrivacyPolicy;
