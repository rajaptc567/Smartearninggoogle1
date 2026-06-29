import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { defaultPrivacyPolicyContent, defaultPrivacyPolicyTitle, defaultPrivacyPolicyUpdated } from '../data/legalDefaults';

const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useData();
    const { settings } = state;

    const title = settings.privacyPolicyTitle || defaultPrivacyPolicyTitle;
    const updated = settings.privacyPolicyUpdated || defaultPrivacyPolicyUpdated;
    const content = settings.privacyPolicyContent || defaultPrivacyPolicyContent;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                         <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-12">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.013A11.959 11.959 0 0112 2.714z" />
                            </svg>
                         </div>
                         <h1 className="text-xl font-black uppercase tracking-tighter">SmartEarning</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate('/')} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6">Back Home</Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-4xl">
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 p-8 md:p-14 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
                    
                    <div className="mb-10">
                        <span className="text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400 uppercase mb-3 block">Security & Trust</span>
                        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-gray-900 dark:text-white mb-4">
                            {title}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {updated}
                        </p>
                    </div>

                    <div className="space-y-8 text-gray-600 dark:text-gray-300 leading-relaxed text-base md:text-lg whitespace-pre-line">
                        <div>{content}</div>
                    </div>
                </div>
            </main>

            <footer className="py-12 text-center text-gray-500 text-sm border-t dark:border-gray-800">
                <p>&copy; {new Date().getFullYear()} SmartEarning. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default PrivacyPolicy;
