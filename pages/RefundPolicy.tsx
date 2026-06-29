import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { defaultRefundPolicyContent, defaultRefundPolicyTitle, defaultRefundPolicyUpdated } from '../data/legalDefaults';

const RefundPolicy: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useData();
    const { settings } = state;

    const title = settings.refundPolicyTitle || defaultRefundPolicyTitle;
    const updated = settings.refundPolicyUpdated || defaultRefundPolicyUpdated;
    const content = settings.refundPolicyContent || defaultRefundPolicyContent;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-12">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h1 className="text-xl font-black uppercase tracking-tighter">SmartEarning</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate('/')} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6">Back Home</Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-4xl">
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 p-8 md:p-14 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-600"></div>
                    
                    <div className="mb-10">
                        <span className="text-xs font-black tracking-[0.2em] text-red-600 dark:text-red-400 uppercase mb-3 block">Financial Integrity</span>
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

export default RefundPolicy;
