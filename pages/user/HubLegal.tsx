import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import ContactUsBox from '../../components/ContactUsBox';

type PolicyTab = 'privacy' | 'terms' | 'cookie' | 'contact' | 'about' | 'antifraud' | 'withdrawal' | 'refund' | 'disclaimer' | 'dmca';

const HubLegal: React.FC = () => {
    const { state } = useData();
    const { settings, currentUser } = state;
    const [searchParams, setSearchParams] = useSearchParams();
    
    const initialTab = (searchParams.get('tab') as PolicyTab) || 'privacy';
    const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);

    useEffect(() => {
        const tabParam = searchParams.get('tab') as PolicyTab;
        if (tabParam && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const handleTabChange = (tab: PolicyTab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    const privacyTitle = settings?.hubPrivacyPolicyTitle || 'Hub Privacy Policy';
    const privacyUpdated = settings?.hubPrivacyPolicyUpdated || 'Last updated: July 21, 2026';
    const privacyContent = settings?.hubPrivacyPolicyContent || "We respect your digital privacy. When you use the Micro Task Hub, we collect standard log data, your completed task proofs, and transaction logs. This information is strictly used to evaluate submission proofs and process withdrawals safely. We do not sell or lease your personal identifiers to marketing brokers. We employ advanced cryptographic protections to secure your balance logs and proof submissions.";

    const termsTitle = settings?.hubTermsOfUseTitle || 'Hub Terms of Service';
    const termsUpdated = settings?.hubTermsOfUseUpdated || 'Last updated: July 21, 2026';
    const termsContent = settings?.hubTermsOfUseContent || "By participating in the Micro Task & Gigs Hub, you agree to: (1) Provide only authentic and unaltered proofs of completed tasks; (2) Refrain from using VPNs, proxies, bot networks, or automated scrapers; (3) Abide by the minimum and maximum deposit/withdrawal thresholds. Fraudulent task submissions will result in immediate profile suspension and forfeiture of your earnings.";

    const refundTitle = settings?.hubRefundPolicyTitle || 'Hub Refund Policy';
    const refundUpdated = settings?.hubRefundPolicyUpdated || 'Last updated: July 21, 2026';
    const refundContent = settings?.hubRefundPolicyContent || "All approved payouts and withdrawals processed through the Micro Task Hub are final and irreversible. If a micro task campaign you launched has uncompleted slots, you can request a refund of the remaining budget to your main wallet by submitting a request to the support team.";

    const cookieTitle = settings?.hubCookiePolicyTitle || 'Hub Cookie Policy';
    const cookieUpdated = settings?.hubCookiePolicyUpdated || 'Last updated: July 21, 2026';
    const cookieContent = settings?.hubCookiePolicyContent || "We use essential cookies and local storage tokens to keep you securely authenticated in the Micro Task Hub, remember your dashboard view preferences, and protect our forms from Cross-Site Request Forgery (CSRF) attempts. By accessing the Work & Earn module, you consent to our use of these technical cookies.";

    const contactTitle = settings?.hubContactUsTitle || 'Hub Contact Us';
    const contactUpdated = settings?.hubContactUsUpdated || 'Last updated: July 21, 2026';
    const contactContent = settings?.hubContactUsContent || "If you have questions, disputes, or issues regarding task completion or withdrawal processing inside the Hub, you can contact us directly by opening a dispute/support ticket inside the 'Disputes & Support' panel or email us at support@taskhub.payouts.";

    const aboutTitle = settings?.hubAboutUsTitle || 'Hub About Us';
    const aboutUpdated = settings?.hubAboutUsUpdated || 'Last updated: July 21, 2026';
    const aboutContent = settings?.hubAboutUsContent || "The Work & Earn Micro Task Hub is a specialized division designed to bridge independent digital gig workers with platform campaigns. We facilitate frictionless nano-campaign verification, secure micro-wallets, and transparent social promotion payouts for members worldwide.";

    const antifraudTitle = settings?.hubAntiFraudPolicyTitle || 'Hub Anti-Fraud Policy';
    const antifraudUpdated = settings?.hubAntiFraudPolicyUpdated || 'Last updated: July 21, 2026';
    const antifraudContent = settings?.hubAntiFraudPolicyContent || "We enforce a zero-tolerance policy against fraudulent activities. This includes submitting fabricated screenshots, multiple accounts registration, mock API completions, or bot scripts. Any detected exploitation will lead to permanent IP blocking, task blacklist, and legal escalation if funds were maliciously obtained.";

    const withdrawalTitle = settings?.hubWithdrawalPolicyTitle || 'Hub Withdrawal Policy';
    const withdrawalUpdated = settings?.hubWithdrawalPolicyUpdated || 'Last updated: July 21, 2026';
    const withdrawalContent = settings?.hubWithdrawalPolicyContent || "Withdrawals from the Micro Task Hub are processed directly to your approved payout methods. All payout requests must respect the minimum and maximum limit guidelines. Withdrawal processing times average 12-48 hours depending on manual queue verification.";

    const disclaimerTitle = settings?.hubDisclaimerTitle || 'Hub Disclaimer';
    const disclaimerUpdated = settings?.hubDisclaimerUpdated || 'Last updated: July 21, 2026';
    const disclaimerContent = settings?.hubDisclaimerContent || "The Micro Task Hub does not guarantee a minimum hourly wage or continuous task availability. Earnings fluctuate based on active advertiser budgets and proof validation. All task completions are performed at the user's discretion and independent contractor responsibility.";

    const dmcaTitle = settings?.hubDmcaPolicyTitle || 'Hub DMCA & Copyright Policy';
    const dmcaUpdated = settings?.hubDmcaPolicyUpdated || 'Last updated: July 21, 2026';
    const dmcaContent = settings?.hubDmcaPolicyContent || "We respect the intellectual property of creators. If you find any tasks, campaigns, social profiles, or images hosted in our hub that infringe upon your copyrighted material, please send a DMCA Takedown Notice containing registration proofs to our support team for prompt review and deletion.";

    const activePolicy = {
        privacy: { title: privacyTitle, updated: privacyUpdated, content: privacyContent, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-500/10' },
        terms: { title: termsTitle, updated: termsUpdated, content: termsContent, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-500/10' },
        cookie: { title: cookieTitle, updated: cookieUpdated, content: cookieContent, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500/10' },
        contact: { title: contactTitle, updated: contactUpdated, content: contactContent, color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-500/10' },
        about: { title: aboutTitle, updated: aboutUpdated, content: aboutContent, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-500/10' },
        antifraud: { title: antifraudTitle, updated: antifraudUpdated, content: antifraudContent, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-500/10' },
        withdrawal: { title: withdrawalTitle, updated: withdrawalUpdated, content: withdrawalContent, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/10' },
        refund: { title: refundTitle, updated: refundUpdated, content: refundContent, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-500/10' },
        disclaimer: { title: disclaimerTitle, updated: disclaimerUpdated, content: disclaimerContent, color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-500/10' },
        dmca: { title: dmcaTitle, updated: dmcaUpdated, content: dmcaContent, color: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 border-fuchsia-500/10' },
    }[activeTab];

    const tabConfig = [
        { key: 'privacy' as PolicyTab, label: privacyTitle, icon: '🔒' },
        { key: 'terms' as PolicyTab, label: termsTitle, icon: '⚖️' },
        { key: 'cookie' as PolicyTab, label: cookieTitle, icon: '🍪' },
        { key: 'contact' as PolicyTab, label: contactTitle, icon: '📞' },
        { key: 'about' as PolicyTab, label: aboutTitle, icon: 'ℹ️' },
        { key: 'antifraud' as PolicyTab, label: antifraudTitle, icon: '🚫' },
        { key: 'withdrawal' as PolicyTab, label: withdrawalTitle, icon: '💳' },
        { key: 'refund' as PolicyTab, label: refundTitle, icon: '💸' },
        { key: 'disclaimer' as PolicyTab, label: disclaimerTitle, icon: '⚠️' },
        { key: 'dmca' as PolicyTab, label: dmcaTitle, icon: '📝' },
    ];

    return (
        <div className="p-4 md:p-8 space-y-6 animate-fade-in text-left">
            {/* Header section */}
            <div className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-600 text-white rounded-2xl p-6 md:p-10 shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 pointer-events-none"></div>
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                    <span className="bg-white/10 text-white font-extrabold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full backdrop-blur-md inline-block mb-3 border border-white/10">
                        Legal Compliance & Corporate Governance
                    </span>
                    <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tighter uppercase leading-none">
                        Hub Terms & Guidelines
                    </h1>
                    <p className="text-blue-100 text-xs md:text-sm max-w-2xl leading-relaxed font-medium">
                        Please review the legal terms, compliance standards, cookies handling, DMCA and withdrawal processing rules governing your participation in the Work & Earn Hub.
                    </p>
                </div>
            </div>

            {/* Grid Layout for tabs & content to make it extremely premium */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Navigation Tabs - Responsive list / sidebar */}
                <div className="lg:col-span-4 space-y-2 max-h-[500px] lg:max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                    <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 px-1">Legal Policies ({tabConfig.length})</div>
                    {tabConfig.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => handleTabChange(tab.key)}
                            className={`w-full text-left p-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-3 transition-all border ${
                                activeTab === tab.key 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md transform translate-x-1' 
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            }`}
                        >
                            <span className="text-sm shrink-0">{tab.icon}</span>
                            <span className="truncate">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Right Policy Detail Panel */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700/50 p-6 md:p-8 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-gray-700 pb-4">
                            <div className="space-y-1">
                                <h2 className="text-lg md:text-2xl font-black uppercase text-gray-900 dark:text-white tracking-tight">
                                    {activePolicy.title}
                                </h2>
                                <p className="text-xs text-gray-400">Micro Task & Gigs Hub Compliance Document</p>
                            </div>
                            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border self-start sm:self-center shrink-0 ${activePolicy.color}`}>
                                {activePolicy.updated}
                            </span>
                        </div>

                        <div className="prose dark:prose-invert max-w-none text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-semibold whitespace-pre-wrap">
                            {activePolicy.content}
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700 flex items-center gap-3 text-xs text-gray-400">
                            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span>Verified secure and legally binding under active digital advertisement campaign regulations.</span>
                        </div>
                    </div>

                    {/* Interactive Contact Us Box on Contact Tab */}
                    {activeTab === 'contact' && (
                        <ContactUsBox settings={settings} currentUser={currentUser} className="my-0" />
                    )}
                </div>
            </div>

            {/* Compliance Note */}
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-xs text-blue-700 dark:text-blue-300">
                <span className="font-black uppercase tracking-wider text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded mr-2 inline-block mb-1.5 sm:mb-0">USER AGREEMENT NOTICE:</span>
                By continuing to utilize the Work & Earn Hub, submit task proofs, deposit advertising capital, or initiate payouts, you affirm that you have read, understood, and consented to each of our active policies.
            </div>
        </div>
    );
};

export default HubLegal;
