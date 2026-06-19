
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
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                         <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-12">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         </div>
                         <h1 className="text-xl font-black uppercase tracking-tighter">Knowledge Center</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(-1)} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6">Back Home</Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-12 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="text-5xl font-black uppercase tracking-tighter mb-4 text-gray-900 dark:text-white">How can we help?</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-xl max-w-2xl mx-auto">Explore our guide to understanding commissions, levels, and advanced network mechanics.</p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-16 transform transition-all focus-within:scale-[1.02]">
                    <input 
                        type="text" 
                        placeholder="Search for 'Overflow', 'Held Funds', 'Level 1'..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-6 pl-16 rounded-[2.5rem] bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-2xl transition-all outline-none text-lg font-medium"
                    />
                    <svg className="w-8 h-8 absolute left-6 top-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                <div className="space-y-8">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 p-10 shadow-xl hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1">
                                <div className="flex gap-6">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-black shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        {index + 1}
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                            {faq.question}
                                        </h3>
                                        <div className="pl-0 border-l-0">
                                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-inner">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">🔍</div>
                            <p className="text-2xl font-black text-gray-400 uppercase tracking-tighter">No matching answers found</p>
                            <p className="text-gray-500 mt-2 font-medium">Try different keywords like "commission", "plan", or "withdrawal".</p>
                            <Button variant="secondary" onClick={() => setSearchTerm('')} className="mt-8 rounded-full px-8 py-3 font-bold">Clear Search</Button>
                        </div>
                    )}
                </div>

                <div className="mt-24 p-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[4rem] text-white text-center shadow-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-white/20 transition-all duration-700"></div>
                    <div className="relative z-10">
                        <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Still have questions?</h3>
                        <p className="mb-10 text-blue-100 max-w-xl mx-auto text-lg font-medium leading-relaxed">Our support architects are available 24/7 to help you optimize your earning strategy and resolve technical issues.</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button style={{ backgroundColor: 'white', color: '#2563eb' }} onClick={() => navigate('/login')} className="rounded-[2rem] px-12 py-5 font-black uppercase text-sm tracking-widest shadow-2xl hover:scale-105 transition-transform border-none">Open Support Ticket</Button>
                            <Button variant="secondary" className="rounded-[2rem] px-12 py-5 font-black uppercase text-sm tracking-widest bg-blue-500/20 text-white border-white/20 hover:bg-blue-500/40 transition-colors">Chat Live with Support</Button>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-12 text-center text-gray-500 text-sm border-t dark:border-gray-800 mt-24">
                <div className="flex justify-center gap-6 mb-4">
                    <a href="#" className="hover:text-blue-500 transition-colors font-bold">Privacy Policy</a>
                    <a href="#" className="hover:text-blue-500 transition-colors font-bold">Terms of Service</a>
                    <a href="#" className="hover:text-blue-500 transition-colors font-bold">Safety Center</a>
                </div>
                <p>&copy; {new Date().getFullYear()} SmartEarning Knowledge Center. Empowering global earners.</p>
            </footer>
        </div>
    );
};

export default FaqPage;
