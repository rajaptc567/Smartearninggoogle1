import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import Button from '../../components/ui/Button';

const HubFaqs: React.FC = () => {
    const { state } = useData();
    const { settings } = state;
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const displayFaqs = useMemo(() => {
        const faqs = settings.hubFaqs && settings.hubFaqs.length > 0 
            ? settings.hubFaqs 
            : [
                {
                    question: "What is the Micro Task & Gigs Hub?",
                    answer: "The Micro Task & Gigs Hub is an independent earning environment where you can perform simple social media and internet micro tasks (like liking, following, subscribing, or testing) to earn instant cash payouts straight into your Hub Wallet."
                },
                {
                    question: "How do I withdraw my task earnings?",
                    answer: "You can withdraw your task earnings by clicking the 'Withdraw Hub Funds' link in your sidebar. All requests are subject to the independent Hub withdrawal limits configured in the system."
                },
                {
                    question: "What are the limits on deposits and withdrawals?",
                    answer: "Minimum and maximum deposit and withdrawal limits are configured dynamically per payment method (e.g. EasyPaisa, JazzCash, USDT, Bank Transfer). You can view the exact limits directly on the Deposit and Withdrawal screens."
                },
                {
                    question: "How long does it take for a task submission to be verified?",
                    answer: "Submissions are checked manually or automatically by the administration. Most micro tasks and proof reviews are completed within 2 to 24 hours of submission."
                }
            ];

        if (!searchTerm) return faqs;
        return faqs.filter(f => 
            f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
            f.answer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [settings.hubFaqs, settings.hubMinDeposit, settings.hubMaxDeposit, settings.hubMinWithdrawal, settings.hubMaxWithdrawal, searchTerm]);

    return (
        <div className="p-4 md:p-8 space-y-6 animate-fade-in text-left">
            {/* Header section */}
            <div className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-2xl md:rounded-[2rem] p-6 md:p-10 shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 pointer-events-none"></div>
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10">
                    <span className="bg-white/10 text-white font-extrabold uppercase tracking-widest text-[10px] px-3 py-1.5 rounded-full backdrop-blur-md inline-block mb-3 border border-white/10">
                        Work & Earn Module
                    </span>
                    <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tighter uppercase leading-none">
                        Hub Knowledge & FAQs
                    </h1>
                    <p className="text-blue-100 text-xs md:text-sm max-w-2xl leading-relaxed font-medium">
                        Get instant answers about completing tasks, wallet withdrawals, proof verification timelines, and eligibility guidelines inside the Micro Task Hub.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
                <input 
                    type="text" 
                    placeholder="Search hub topics (e.g., 'withdraw', 'proof', 'earnings')..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-4 pl-12 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                <svg className="w-5 h-5 absolute left-4 top-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {/* FAQ List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayFaqs.length > 0 ? (
                    displayFaqs.map((faq, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800/80 rounded-xl border dark:border-gray-700/50 p-6 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-200">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold shrink-0">
                                    {index + 1}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                                        {faq.question}
                                    </h3>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-2 text-center py-12 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-bold text-gray-400 uppercase">No matching FAQs found</p>
                        <p className="text-xs text-gray-500 mt-1">Try searching for other keywords.</p>
                        <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')} className="mt-4">Reset Search</Button>
                    </div>
                )}
            </div>

            {/* Support section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Still confused about tasks?</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Reach out to our customer support or initiate a support dispute ticket.</p>
                </div>
                <Button variant="secondary" onClick={() => navigate('/member/disputes')} className="rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider shrink-0 bg-white border border-gray-200 hover:bg-gray-50">
                    Contact Disputes & Support
                </Button>
            </div>
        </div>
    );
};

export default HubFaqs;
