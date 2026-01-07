
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';

const FaqPage: React.FC = () => {
    const { state } = useData();
    const { settings } = state;
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredFaqs = useMemo(() => {
        const faqs = settings.faqs || [];
        if (!searchTerm) return faqs;
        return faqs.filter(f => 
            f.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
            f.answer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [settings.faqs, searchTerm]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                         <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
                         <h1 className="text-xl font-bold">SmartEarning Support</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-12 max-w-4xl">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Knowledge Base</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Search our frequently asked questions to find answers instantly.</p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-12">
                    <input 
                        type="text" 
                        placeholder="Type keywords (e.g. withdrawal, deposit, referral)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-5 pl-12 rounded-3xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 shadow-xl transition-all"
                    />
                    <svg className="w-6 h-6 absolute left-4 top-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                <div className="space-y-6">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 p-8 shadow-sm hover:shadow-md transition-shadow">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-start gap-3">
                                    <span className="text-blue-500 font-black">Q.</span>
                                    {faq.question}
                                </h3>
                                <div className="pl-8 border-l-2 border-blue-50 dark:border-blue-900/30">
                                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed dark:border-gray-700">
                            <p className="text-xl font-bold text-gray-400">No matching questions found.</p>
                            <p className="text-gray-500 mt-2">Try different keywords or contact live support.</p>
                        </div>
                    )}
                </div>

                <div className="mt-16 p-10 bg-blue-600 rounded-[3rem] text-white text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <h3 className="text-2xl font-bold mb-4">Still have questions?</h3>
                    <p className="mb-8 text-blue-100 max-w-xl mx-auto">Our support team is available 24/7 to help you with any technical or account-related issues.</p>
                    <div className="flex justify-center gap-4">
                        <Button style={{ backgroundColor: 'white', color: '#2563eb' }} onClick={() => navigate('/login')}>Open Support Ticket</Button>
                    </div>
                </div>
            </main>

            <footer className="py-8 text-center text-gray-500 text-sm border-t dark:border-gray-800 mt-12">
                &copy; {new Date().getFullYear()} SmartEarning Knowledge Center. All rights reserved.
            </footer>
        </div>
    );
};

export default FaqPage;
