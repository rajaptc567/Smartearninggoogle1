
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PaymentMethod, Status, formatCurrency, currencySymbols, Deposit } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createDeposit } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import FetchingInline from '../../components/FetchingInline';

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg className="w-3.5 h-3.5 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
);

// Helper component to detect and highlight links in text with premium styling
const Linkify: React.FC<{ text: string; primaryColor: string }> = ({ text, primaryColor }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <span className="whitespace-pre-line leading-relaxed">
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center font-black underline decoration-2 underline-offset-4 hover:opacity-80 transition-all px-2 py-0.5 rounded-lg mx-0.5 shadow-sm"
                            style={{ 
                                color: primaryColor, 
                                backgroundColor: `${primaryColor}15`,
                                border: `1px solid ${primaryColor}25`
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            <ExternalLinkIcon />
                        </a>
                    );
                }
                return part;
            })}
        </span>
    );
};

const StepIndicator: React.FC<{ currentStep: number; primaryColor?: string }> = ({ currentStep, primaryColor = '#2563eb' }) => {
    const steps = ['Amount', 'Method', 'Instructions', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-2xl mx-auto px-4 relative">
             <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-0 hidden sm:block"></div>
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div 
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 transform ${isActive ? 'text-white shadow-xl scale-110' : isCompleted ? 'bg-green-50 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}`}
                            style={isActive ? { backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}44` } : {}}
                        >
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[10px] mt-3 font-black uppercase tracking-[0.1em] transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`} style={isActive ? { color: primaryColor } : {}}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const DepositFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, currentUser, investmentPlans, deposits, settings } = state;
    const navigate = useNavigate();

    // Default or Custom Page config
    const pageConfig = settings.uiCustomization?.depositPage || {
        primaryColor: '#2563eb',
        cardRounding: '2.5rem',
        buttonText: 'Deposit Now'
    };

    // Wizard State
    const [step, setStep] = useState(1);
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [expandedDepositId, setExpandedDepositId] = useState<string | null>(null);
    const [senderAccountTitle, setSenderAccountTitle] = useState('');
    const [receipt, setReceipt] = useState<File | null>(null);
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // Guide State
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const modalContentRef = useRef<HTMLDivElement>(null);

    // History Filter State (Audit Log)
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const planPrices = useMemo(() => {
        if (!currentUser) return [];
        return investmentPlans
            .filter(p => p.status === Status.Active && p.currency === currentUser.currency)
            .map(p => p.price)
            .sort((a, b) => a - b)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [investmentPlans, currentUser]);

    const availableMethods = useMemo(() => {
        if (!currentUser) return [];
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return [];
        return paymentMethods.filter(method => 
            method.type === 'Deposit' && 
            method.status === 'Enabled' &&
            method.currency === currentUser.currency &&
            method.minAmount <= numericAmount && 
            method.maxAmount >= numericAmount
        );
    }, [paymentMethods, amount, currentUser]);

    const selectedMethod = useMemo(() =>
        availableMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, availableMethods]
    );

    const filteredDeposits = useMemo(() => {
        if (!currentUser) return [];
        return deposits.filter(d => {
            if (d.userId !== currentUser._id) return false;
            if (historyStatus && d.status !== historyStatus) return false;
            if (historyDateFrom || historyDateTo) {
                const itemDate = new Date(d.date).setHours(0,0,0,0);
                const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : null;
                const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : null;
                if (from && itemDate < from) return false;
                if (to && itemDate > to) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [deposits, currentUser, historyStatus, historyDateFrom, historyDateTo]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [historyStatus, historyDateFrom, historyDateTo, itemsPerPage]);

    // Pagination Logic
    const totalItems = filteredDeposits.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedDeposits = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredDeposits.slice(start, start + itemsPerPage);
    }, [filteredDeposits, currentPage, itemsPerPage]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const progress = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
        setScrollProgress(progress);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMethod || !amount || !transactionId || !senderAccountTitle || !receipt || !currentUser) return;
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('userId', currentUser._id);
        formData.append('userName', currentUser.username);
        formData.append('method', selectedMethod.name);
        formData.append('amount', amount);
        formData.append('transactionId', transactionId);
        formData.append('senderAccountTitle', senderAccountTitle);
        formData.append('receipt', receipt);
        if(userNotes) formData.append('userNotes', userNotes);
        if(selectedMethod.p2pWithdrawalId) formData.append('matchedWithdrawalId', selectedMethod.p2pWithdrawalId);
        try {
            const { deposit, transaction } = await createDeposit(formData);
            dispatch({ type: 'ADD_DEPOSIT', payload: deposit });
            dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
            setIsSubmitted(true);
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Submit failure'}`);
        } finally { setIsSubmitting(false); }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Data copied to clipboard!');
    };

    if (!currentUser) return null;
    if (currentUser.restrictions?.deposit) return <div className="p-20 text-center font-black uppercase text-red-500 tracking-widest">Access Restricted: Deposits Disabled</div>;

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-800 animate-fade-in">
                <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-green-400 to-green-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Deposit Transmitted!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed font-medium">Your request has been securely received. Auditors will confirm your transaction shortly.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Transaction</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Back to Hub</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-16 px-2">
            <style>{`
                .guide-item:before { content: ''; position: absolute; left: 1.5rem; top: 3rem; bottom: -3rem; width: 4px; background: #f3f4f6; border-radius: 99px; }
                .guide-item:last-child:before { display: none; }
                .dark .guide-item:before { background: #1f2937; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="p-8 md:p-10 text-white shadow-2xl relative overflow-hidden mb-12 group transition-all" style={{ backgroundColor: pageConfig.primaryColor, borderRadius: pageConfig.cardRounding }}>
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-none">Deposit Funds</h1>
                    <p className="text-blue-50 text-sm md:text-base max-w-2xl leading-relaxed font-medium">Add funds to your wallet securely. Follow the sequence to complete your deposit.</p>
                </div>
            </div>

            <StepIndicator currentStep={step} primaryColor={pageConfig.primaryColor} />

            <div className="bg-white dark:bg-gray-950 p-8 sm:p-12 shadow-xl border border-gray-100 dark:border-gray-800" style={{ borderRadius: pageConfig.cardRounding }}>
                {step === 1 && (
                    <div className="animate-fade-in space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-2 mb-6">
                            <h3 className="text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">Amount Selection</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Select an amount based on active plan pricing</p>
                        </div>
                        {planPrices.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {planPrices.map(price => (
                                    <button
                                        key={price}
                                        type="button"
                                        onClick={() => setAmount(price.toString())}
                                        className={`py-5 px-6 rounded-3xl font-black uppercase text-xs tracking-widest transition-all border-2`}
                                        style={{ 
                                            backgroundColor: amount === price.toString() ? pageConfig.primaryColor : 'transparent',
                                            color: amount === price.toString() ? '#fff' : '#6b7280',
                                            borderColor: amount === price.toString() ? pageConfig.primaryColor : 'rgba(0,0,0,0.05)',
                                            boxShadow: amount === price.toString() ? `0 20px 25px -5px ${pageConfig.primaryColor}44` : 'none'
                                        }}
                                    >
                                        {formatCurrency(price, currentUser.currency)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Button 
                            onClick={() => setStep(2)} 
                            disabled={!amount}
                            className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl"
                            style={{ backgroundColor: pageConfig.primaryColor }}
                        >
                            Next Step &rarr;
                        </Button>
                    </div>
                )}
                
                 {step === 2 && (
                     <div className="w-full space-y-6">
                         <FetchingInline messageType="Payment methods" customLabel="Loading payment options..." />
                         <FetchingInline messageType="Payment method without user login" customLabel="Searching public payment system..." />
                         <div className="grid grid-cols-2 gap-4 md:gap-6 animate-fade-in">
                             {availableMethods.map(m => (
                                 <div key={m._id} onClick={() => { setSelectedMethodId(m._id); setStep(3); }} className="p-8 border-2 text-center cursor-pointer transition-all hover:scale-105 rounded-3xl bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800 hover:border-blue-500 shadow-sm hover:shadow-xl">
                                     <img src={m.logoUrl} className="h-20 mx-auto mb-4 object-contain" alt={m.name} />
                                     <h4 className="font-black uppercase text-sm tracking-tight">{m.name}</h4>
                                     <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1 block">Click to select</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-10">
                        <div className="text-center">
                            <h2 className="text-5xl font-black mb-2" style={{ color: pageConfig.primaryColor }}>{formatCurrency(parseFloat(amount), currentUser.currency)}</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Payment Destination Instructions</p>
                        </div>

                        <div className="p-10 bg-[#0f172a] rounded-[2.5rem] text-white space-y-10 shadow-2xl border border-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                                {/* ACCOUNT MAIN INFO */}
                                <div className="space-y-10 flex-grow w-full">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-500 font-black tracking-widest mb-1">
                                                {selectedMethod.customLabels?.providerLabel || 'Method Name'}
                                            </p>
                                            <p className="text-xl font-bold">{selectedMethod.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-gray-500 font-black tracking-widest mb-1">
                                                {selectedMethod.customLabels?.accountTitleLabel || 'Account Title'}
                                            </p>
                                            <p className="text-xl font-bold">{selectedMethod.accountTitle}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-gray-500 font-black tracking-widest mb-2">
                                            {selectedMethod.customLabels?.accountNumberLabel || 'Account / Wallet Number'}
                                        </p>
                                        <div className="flex items-center justify-between p-4 sm:p-6 bg-black/50 rounded-3xl border border-white/5 shadow-inner min-w-0 w-full">
                                            <p className="text-base sm:text-2xl font-black font-mono text-blue-400 select-all whitespace-nowrap overflow-x-auto scrollbar-none min-w-0 flex-1 mr-2 sm:mr-4">{selectedMethod.accountNumber}</p>
                                            <button onClick={() => handleCopy(selectedMethod.accountNumber)} className="p-2 sm:p-3 bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shrink-0 shadow-lg">
                                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* DYNAMIC EXTRA FIELDS */}
                                    {selectedMethod.customFields && selectedMethod.customFields.length > 0 && (
                                        <div className="pt-4 space-y-6">
                                            <p className="text-[10px] uppercase text-gray-500 font-black tracking-widest border-b border-white/5 pb-2">Required Supplementary Details</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                {selectedMethod.customFields.map((field, idx) => (
                                                    <div key={idx} className="group">
                                                        <p className="text-[9px] uppercase text-gray-500 font-black tracking-widest mb-1 opacity-80 group-hover:text-blue-400 transition-colors">{field.title}</p>
                                                        <div className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                                            <p className="text-base font-bold text-gray-100 truncate pr-2">{field.value}</p>
                                                            <button onClick={() => handleCopy(field.value)} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* QR CODE (IF AVAILABLE) */}
                                {selectedMethod.qrCodeUrl && (
                                    <div className="shrink-0 flex flex-col items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-xl border-4 border-blue-500/10">
                                        <img src={selectedMethod.qrCodeUrl} alt="Scan to Pay" className="w-48 h-48 object-contain" />
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em]">Scan to Pay</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SPECIAL INSTRUCTIONS WITH LINK DETECTION */}
                        {selectedMethod.instructions && (
                            <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[2.5rem] shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-2xl">⚡</span>
                                    <h4 className="font-black text-sm uppercase text-amber-700 dark:text-amber-500 tracking-widest">Admin Advisory & Instructions</h4>
                                </div>
                                <div className="text-gray-700 dark:text-gray-300 font-bold text-base leading-relaxed">
                                    <Linkify text={selectedMethod.instructions} primaryColor={pageConfig.primaryColor} />
                                </div>
                            </div>
                        )}

                        {/* HOW TO GUIDE TRIGGER */}
                        {selectedMethod.howToDeposit?.enabled && selectedMethod.howToDeposit.steps?.length > 0 && (
                            <div className="p-8 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/40 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-white dark:bg-gray-800 flex items-center justify-center text-3xl shadow-sm border border-blue-100 dark:border-blue-800">📖</div>
                                    <div>
                                        <h4 className="font-black text-lg uppercase tracking-tight text-gray-900 dark:text-white">Visual How-To Guide</h4>
                                        <p className="text-sm text-gray-500 font-medium">New member? Walk through the step-by-step tutorial.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsGuideOpen(true)}
                                    className="px-10 py-4 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all active:scale-95"
                                >
                                    Open Step-by-Step Guide
                                </button>
                            </div>
                        )}

                        <div className="pt-6 flex flex-col sm:flex-row gap-4">
                            <button onClick={() => setStep(2)} className="flex-1 py-5 rounded-2xl font-black uppercase text-xs text-gray-400 hover:text-blue-600 transition-colors">Return to Methods</button>
                            <Button className="flex-[2] py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20" onClick={() => setStep(4)} style={{ backgroundColor: pageConfig.primaryColor }}>I have transferred funds &rarr;</Button>
                        </div>
                    </div>
                )}

                 {step === 4 && (
                    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in max-w-2xl mx-auto">
                        <div className="text-center space-y-2 mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Audit Submission</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Step 4: Final verification and proof</p>
                        </div>
                        <div className="space-y-6">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Sender Account Name</label><input className="w-full p-5 rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="TITLE OF YOUR SENDER ACCOUNT" value={senderAccountTitle} onChange={e => setSenderAccountTitle(e.target.value)} required /></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Digital ID (Transaction ID)</label><input className="w-full p-5 rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="REFERENCE NUMBER FROM SLIP" value={transactionId} onChange={e => setTransactionId(e.target.value)} required /></div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Verification Proof (Screenshot)</label>
                                <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2rem] p-10 text-center bg-gray-50 dark:bg-gray-900/30 group hover:border-blue-500 transition-colors">
                                    <input type="file" id="receipt" className="hidden" onChange={e => e.target.files && setReceipt(e.target.files[0])} required />
                                    <label htmlFor="receipt" className="cursor-pointer">
                                        {receipt ? <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">✓</div><span className="text-xs font-bold text-green-600">{receipt.name}</span></div> : <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">📁</div><span className="text-[10px] text-gray-500 font-black uppercase">Click to Select Receipt</span></div>}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20" style={{ backgroundColor: pageConfig.primaryColor }}>{isSubmitting ? 'Transmitting Data...' : pageConfig.buttonText}</Button>
                    </form>
                )}
            </div>

            {/* DEPOSIT HISTORY SECTION (Audit Log) */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-12">
                <FetchingInline messageType="Fresh funds" customLabel="Updating currency flows..." />
                <FetchingInline messageType="Payment deposit funds" customLabel="Synchronizing ledger assets..." />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">History Log</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Show:</label>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-1 px-2"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800">
                            <input 
                                type="date" 
                                value={historyDateFrom} 
                                onChange={(e) => setHistoryDateFrom(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[10px] font-black uppercase focus:ring-0" 
                            />
                            <span className="text-gray-300 dark:text-gray-700">|</span>
                            <input 
                                type="date" 
                                value={historyDateTo} 
                                onChange={(e) => setHistoryDateTo(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[10px] font-black uppercase focus:ring-0" 
                            />
                        </div>
                    </div>
                </div>

                {paginatedDeposits.length > 0 ? (
                    <>
                        <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                            <Table headers={['Date', 'Provider', 'Amount', 'Trx ID', 'Status']}>
                                {paginatedDeposits.map(deposit => (
                                    <tr key={deposit._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-blue-900/5 transition-colors group">
                                        <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(deposit.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{deposit.method}</td>
                                        <td className="px-6 py-5 font-black text-gray-900 dark:text-white">{formatCurrency(deposit.amount, deposit.currency)}</td>
                                        <td className="px-6 py-5 text-[11px] font-mono text-gray-400 select-all">{deposit.transactionId}</td>
                                        <td className="px-6 py-5">
                                            <Badge status={deposit.status as Status} />
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </div>

                        {/* Mobile View Audit Log */}
                        <div className="md:hidden space-y-4">
                            {paginatedDeposits.map(deposit => (
                                <div key={deposit._id} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300">
                                    <div 
                                        className="p-4 flex items-center justify-between cursor-pointer"
                                        onClick={() => setExpandedDepositId(expandedDepositId === deposit._id ? null : deposit._id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{deposit.method}</span>
                                            <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(deposit.amount, deposit.currency)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge status={deposit.status as Status} />
                                            <div className={`w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-blue-500 transition-transform shadow-sm ${expandedDepositId === deposit._id ? 'rotate-180' : ''}`}>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {expandedDepositId === deposit._id && (
                                        <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p>
                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{new Date(deposit.date).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Transaction ID</p>
                                                    <p className="text-xs font-mono font-bold text-blue-500 break-all select-all">{deposit.transactionId}</p>
                                                </div>
                                                {deposit.notes && (
                                                    <div className="col-span-2 pt-2 border-t dark:border-gray-800">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Admin Notes</p>
                                                        <p className="text-[10px] text-gray-500 italic">"{deposit.notes}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* Pagination Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4 border-t dark:border-gray-800 pt-6">
                            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                Page {currentPage} of {totalPages || 1} ({totalItems} records)
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest"
                                >
                                    &larr; Prev
                                </Button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = i + 1;
                                        if (totalPages > 5 && currentPage > 3) {
                                            pageNum = currentPage - 3 + i + 1;
                                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                        }
                                        if (pageNum <= 0) return null;
                                        
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                                                    currentPage === pageNum 
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest"
                                >
                                    Next &rarr;
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No deposit entries found in ledger</p>
                    </div>
                )}
            </div>

            {/* HOW TO GUIDE MODAL */}
            {isGuideOpen && selectedMethod?.howToDeposit && (
                <Modal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)}>
                    <div className="relative w-[95vw] max-w-4xl h-[85vh] flex flex-col bg-white dark:bg-gray-950 rounded-[3rem] overflow-hidden">
                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 dark:bg-gray-900 z-50">
                            <div 
                                className="h-full transition-all duration-300 ease-out" 
                                style={{ width: `${scrollProgress}%`, backgroundColor: pageConfig.primaryColor }}
                            />
                        </div>

                        {/* Modal Header */}
                        <div className="p-8 md:p-12 border-b dark:border-gray-800 flex justify-between items-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-md z-40">
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">Instructional Sequence</h3>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-2">Completing transfer via {selectedMethod.name}</p>
                            </div>
                            <button onClick={() => setIsGuideOpen(false)} className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div 
                            ref={modalContentRef}
                            onScroll={handleScroll}
                            className="flex-grow overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-16"
                        >
                            {selectedMethod.howToDeposit.steps.map((step, idx) => (
                                <div key={idx} className="relative pl-16 md:pl-24 guide-item animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                    {/* Number Indicator */}
                                    <div 
                                        className="absolute left-0 top-0 w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-2xl font-black text-white shadow-2xl transition-transform hover:scale-110"
                                        style={{ backgroundColor: pageConfig.primaryColor }}
                                    >
                                        {idx + 1}
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{step.title}</h4>
                                        <div className="text-gray-600 dark:text-gray-400 font-medium text-lg leading-relaxed max-w-2xl">
                                            <Linkify text={step.description} primaryColor={pageConfig.primaryColor} />
                                        </div>
                                        
                                        {step.imageUrl && (
                                            <div className="mt-8 rounded-[2.5rem] overflow-hidden border-8 border-gray-100 dark:border-gray-900 shadow-2xl bg-white dark:bg-gray-900 group relative">
                                                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all duration-500" />
                                                <img 
                                                    src={step.imageUrl} 
                                                    alt={step.title} 
                                                    className="w-full h-auto max-h-[500px] object-contain transition-transform duration-700 group-hover:scale-[1.02] cursor-zoom-in"
                                                    onClick={() => window.open(step.imageUrl, '_blank')}
                                                />
                                                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white text-[9px] font-black uppercase px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Click to Zoom
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <div className="pt-10 pb-6 text-center">
                                <Button 
                                    onClick={() => setIsGuideOpen(false)}
                                    className="px-16 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                    style={{ backgroundColor: pageConfig.primaryColor }}
                                >
                                    I Understand, Proceed to Transfer
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default DepositFunds;
