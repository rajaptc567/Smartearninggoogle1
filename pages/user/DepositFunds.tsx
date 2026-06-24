
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PaymentMethod, Status, formatCurrency, currencySymbols, Deposit } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createDeposit } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';

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
        <div className="flex items-center justify-between mb-4 sm:mb-8 w-full max-w-2xl mx-auto px-2 sm:px-4 relative">
             <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-0 hidden sm:block"></div>
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div 
                            className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-[11px] sm:text-xs transition-all duration-500 transform ${isActive ? 'text-white shadow-lg scale-105' : isCompleted ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}`}
                            style={isActive ? { backgroundColor: primaryColor, boxShadow: `0 5px 10px -2px ${primaryColor}44` } : isCompleted ? { backgroundColor: '#10b981' } : {}}
                        >
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[8px] sm:text-[10px] mt-1 sm:mt-2 font-black uppercase tracking-[0.05em] sm:tracking-[0.1em] transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`} style={isActive ? { color: primaryColor } : {}}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const HowToDepositSlider: React.FC<{
    steps: { title: string; description: string; imageUrl?: string }[];
    primaryColor: string;
    onFinish: () => void;
}> = ({ steps, primaryColor, onFinish }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextStep = () => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onFinish();
        }
    };

    const prevStep = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const currentStep = steps[currentIndex];
    if (!currentStep) return null;

    return (
        <div className="w-full flex flex-col gap-3 sm:gap-6 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-850 shadow-md">
            {/* Top Indicator & Step Dot Progress */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 dark:border-slate-800 pb-3 sm:pb-5 gap-2 sm:gap-3">
                <div className="flex justify-between items-center w-full sm:w-auto">
                    <div>
                         <span className="text-[8px] sm:text-[9px] font-black uppercase text-blue-500 tracking-[0.2em] block">Method Guide</span>
                         <h4 className="text-sm sm:text-xl font-black uppercase text-slate-800 dark:text-slate-100 tracking-tight">
                             Step {currentIndex + 1} of {steps.length}
                         </h4>
                    </div>
                </div>
                
                {/* Steps Quick Selector Tabbed Row */}
                <div className="flex flex-wrap gap-1 sm:gap-2">
                    {steps.map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentIndex(idx)}
                            className={`px-2 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${idx === currentIndex ? 'text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:opacity-85'}`}
                            style={idx === currentIndex ? { backgroundColor: primaryColor } : {}}
                        >
                            S{idx + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split Visual Grid Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-stretch pt-1 sm:pt-2">
                {/* Pictorial Frame on Left / Top */}
                <div className="flex flex-col items-center justify-center bg-gray-100/50 dark:bg-slate-950/80 p-2 sm:p-4 rounded-xl sm:rounded-3xl border border-dashed border-gray-200 dark:border-slate-800/80 shadow-inner overflow-hidden relative group min-h-[140px] sm:min-h-[250px]">
                    {currentStep.imageUrl ? (
                        <>
                            <img
                                src={currentStep.imageUrl}
                                alt={currentStep.title}
                                className="object-contain max-h-[140px] sm:max-h-[260px] max-w-full rounded-lg sm:rounded-2xl transition-all duration-500 ease-out transform group-hover:scale-[1.03] active:scale-95 cursor-zoom-in shadow-md"
                                onClick={() => window.open(currentStep.imageUrl, '_blank')}
                                referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-x-0 bottom-2 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="text-[8px] sm:text-[9px] uppercase font-black bg-black/70 text-white px-2 py-0.5 rounded-full backdrop-blur-md tracking-wider">Click to Zoom View</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 sm:p-8 text-center space-y-2 sm:space-y-4">
                            <span className="text-3xl sm:text-5xl animate-pulse">📝</span>
                            <div>
                                <h5 className="text-[10px] sm:text-xs font-black uppercase text-slate-500 dark:text-slate-400">Written Instructions</h5>
                                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">Please reference guidelines on the side</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Details on Right / Bottom */}
                <div className="flex flex-col justify-between h-full space-y-4 sm:space-y-8 min-h-0 sm:min-h-[250px]">
                    <div className="space-y-2 sm:space-y-4">
                        <div className="flex items-center gap-2">
                            <span 
                                className="inline-block px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white shadow-sm"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Guide Phase {currentIndex + 1}
                            </span>
                        </div>
                        <h4 className="text-base sm:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-white">
                            {currentStep.title}
                        </h4>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-bold leading-relaxed pr-2">
                            <Linkify text={currentStep.description} primaryColor={primaryColor} />
                        </div>
                    </div>

                    {/* Bottom controls of individual tutorial panel */}
                    <div className="flex gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-150 dark:border-slate-850">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentIndex === 0}
                            className={`flex-1 py-2.5 sm:py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${currentIndex === 0 ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50 active:scale-95'}`}
                        >
                            &larr; Prev
                        </button>
                        <Button
                            type="button"
                            onClick={nextStep}
                            className="flex-[2] py-2.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all text-center"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {currentIndex === steps.length - 1 ? 'Finish Tutorial ✓' : 'Next Step &rarr;'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Slider Dots below picture and details */}
            <div className="flex items-center justify-center gap-2 pt-1">
                {steps.map((_, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 border ${idx === currentIndex ? 'scale-110 border-transparent animate-pulse' : 'border-slate-300 dark:border-slate-700 hover:opacity-100 opacity-50'}`}
                        style={idx === currentIndex ? { backgroundColor: primaryColor } : {}}
                        title={`Go to Step ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

const DepositFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, currentUser, investmentPlans, deposits, settings } = state;
    const navigate = useNavigate();

    const whatsappNumber = settings?.whatsappNumber;
    const cleanedWhatsappNumber = whatsappNumber ? whatsappNumber.replace(/[^0-9]/g, '') : '';
    const whatsappLink = cleanedWhatsappNumber ? `https://wa.me/${cleanedWhatsappNumber}` : null;

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
    const [confirmationAnswers, setConfirmationAnswers] = useState<Record<string, string>>({});
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
    const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
    
    // Guide State
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isGuideExpanded, setIsGuideExpanded] = useState(true);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [lastAutoShownMethodId, setLastAutoShownMethodId] = useState<string | null>(null);
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

    useEffect(() => {
        if (step === 3 && selectedMethod) {
            if (selectedMethod.howToDeposit?.enabled && selectedMethod.howToDeposit?.showBeforePayment) {
                if (lastAutoShownMethodId !== selectedMethod._id) {
                    setIsGuideOpen(true);
                    setLastAutoShownMethodId(selectedMethod._id);
                }
            }
        } else if (step !== 3) {
            setLastAutoShownMethodId(null);
        }
    }, [step, selectedMethodId, selectedMethod, lastAutoShownMethodId]);

    useEffect(() => {
        if (selectedMethod) {
            if (selectedMethod.howToDeposit?.dropdownMode) {
                if (selectedMethod.howToDeposit?.showBeforePayment) {
                    setIsGuideExpanded(false);
                } else {
                    setIsGuideExpanded(true);
                }
            } else {
                setIsGuideExpanded(true);
            }
        }
    }, [selectedMethodId, selectedMethod]);

    useEffect(() => {
        if (selectedMethod) {
            const initialMap: Record<string, string> = {};
            if (selectedMethod.confirmationFields) {
                selectedMethod.confirmationFields.forEach(f => {
                    initialMap[f.label] = '';
                });
            }
            setConfirmationAnswers(initialMap);
        } else {
            setConfirmationAnswers({});
        }
    }, [selectedMethodId, selectedMethod]);

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
        formData.append('confirmationAnswers', JSON.stringify(confirmationAnswers));
        if(userNotes) formData.append('userNotes', userNotes);
        if(selectedMethod.p2pWithdrawalId) formData.append('matchedWithdrawalId', selectedMethod.p2pWithdrawalId);
        try {
            const { deposit, transaction } = await createDeposit(formData);
            dispatch({ type: 'ADD_DEPOSIT', payload: deposit });
            dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
            setIsSubmitted(true);
            if (whatsappLink && settings?.whatsappDepositProofEnabled !== false) {
                setShowWhatsAppPopup(true);
            }
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
            <div className="relative">
                <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-800 animate-fade-in">
                    <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-green-400 to-green-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                        <CheckCircleIcon className="h-12 w-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Deposit Transmitted!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed font-medium">Your request has been securely received. Auditors will confirm your transaction shortly.</p>
                    
                    {whatsappLink && settings?.whatsappDepositProofEnabled !== false && (
                        <div className="mb-8 p-5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-center">
                            <div className="flex items-center justify-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.63-1.019-5.101-2.871-6.955C16.6 1.93 14.124.912 11.493.912c-5.438 0-9.863 4.42-9.866 9.865-.001 1.745.457 3.447 1.328 4.966L1.93 21.054l5.428-1.424-.711-.476zm11.01-6.17c-.31-.156-1.84-.908-2.126-1.012-.287-.104-.496-.156-.705.156-.209.312-.81 1.012-.992 1.22-.183.208-.365.234-.675.078-.31-.156-1.31-.48-2.493-1.537-.92-.818-1.54-1.83-1.72-2.14-.18-.31-.019-.477.136-.631.14-.139.31-.362.465-.544.155-.181.206-.31.31-.518.104-.208.052-.389-.026-.544-.078-.156-.705-1.7-.966-2.327-.254-.61-.514-.528-.705-.528-.183 0-.391-.012-.6-.012s-.548.078-.835.39c-.287.313-1.096 1.072-1.096 2.614 0 1.54 1.121 3.03 1.277 3.238.156.208 2.207 3.37 5.348 4.729.747.323 1.33.516 1.784.66.751.238 1.436.204 1.977.123.602-.09 1.84-.753 2.1-1.443.26-.69.26-1.282.182-1.403-.078-.12-.286-.19-.597-.346z" />
                                </svg>
                                <span className="font-black text-xs uppercase tracking-wider">Super Fast Approval</span>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                                For super fast approval, please upload the screenshot of your deposited funds to our official WhatsApp support number.
                            </p>
                            <a 
                                href={whatsappLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-black uppercase text-[10px] sm:text-xs tracking-widest rounded-xl shadow-md transition-all hover:shadow-lg hover:scale-[1.03]"
                            >
                                Upload Screenshot to WhatsApp &rarr;
                            </a>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Transaction</Button>
                        <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Back to Hub</Button>
                    </div>
                </div>

                {/* Beautiful Modal Overlay for WhatsApp Screenshot Prompt */}
                {showWhatsAppPopup && whatsappLink && settings?.whatsappDepositProofEnabled !== false && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
                        <div className="bg-white dark:bg-gray-950 rounded-[2rem] max-w-md w-full p-6 sm:p-8 shadow-2xl border-4 border-emerald-500 text-center relative overflow-hidden transform transition-all duration-300 scale-100">
                            {/* Close Button */}
                            <button 
                                onClick={() => setShowWhatsAppPopup(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* WhatsApp Vibrating Icon */}
                            <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30 animate-pulse">
                                <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.63-1.019-5.101-2.871-6.955C16.6 1.93 14.124.912 11.493.912c-5.438 0-9.863 4.42-9.866 9.865-.001 1.745.457 3.447 1.328 4.966L1.93 21.054l5.428-1.424-.711-.476zm11.01-6.17c-.31-.156-1.84-.908-2.126-1.012-.287-.104-.496-.156-.705.156-.209.312-.81 1.012-.992 1.22-.183.208-.365.234-.675.078-.31-.156-1.31-.48-2.493-1.537-.92-.818-1.54-1.83-1.72-2.14-.18-.31-.019-.477.136-.631.14-.139.31-.362.465-.544.155-.181.206-.31.31-.518.104-.208.052-.389-.026-.544-.078-.156-.705-1.7-.966-2.327-.254-.61-.514-.528-.705-.528-.183 0-.391-.012-.6-.012s-.548.078-.835.39c-.287.313-1.096 1.072-1.096 2.614 0 1.54 1.121 3.03 1.277 3.238.156.208 2.207 3.37 5.348 4.729.747.323 1.33.516 1.784.66.751.238 1.436.204 1.977.123.602-.09 1.84-.753 2.1-1.443.26-.69.26-1.282.182-1.403-.078-.12-.286-.19-.597-.346z" />
                                </svg>
                            </div>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">Fast Approval Required</h3>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-widest text-[11px]">Upload Screenshot to WhatsApp</p>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed font-medium">
                                To complete your request and get super fast approval, please upload a screenshot of your payment transfer transaction to our official WhatsApp support number.
                            </p>

                            <div className="space-y-3">
                                <a 
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                                >
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.63-1.019-5.101-2.871-6.955C16.6 1.93 14.124.912 11.493.912c-5.438 0-9.863 4.42-9.866 9.865-.001 1.745.457 3.447 1.328 4.966L1.93 21.054l5.428-1.424-.711-.476zm11.01-6.17c-.31-.156-1.84-.908-2.126-1.012-.287-.104-.496-.156-.705.156-.209.312-.81 1.012-.992 1.22-.183.208-.365.234-.675.078-.31-.156-1.31-.48-2.493-1.537-.92-.818-1.54-1.83-1.72-2.14-.18-.31-.019-.477.136-.631.14-.139.31-.362.465-.544.155-.181.206-.31.31-.518.104-.208.052-.389-.026-.544-.078-.156-.705-1.7-.966-2.327-.254-.61-.514-.528-.705-.528-.183 0-.391-.012-.6-.012s-.548.078-.835.39c-.287.313-1.096 1.072-1.096 2.614 0 1.54 1.121 3.03 1.277 3.238.156.208 2.207 3.37 5.348 4.729.747.323 1.33.516 1.784.66.751.238 1.436.204 1.977.123.602-.09 1.84-.753 2.1-1.443.26-.69.26-1.282.182-1.403-.078-.12-.286-.19-.597-.346z" />
                                    </svg>
                                    Open WhatsApp Now &rarr;
                                </a>
                                <button 
                                    onClick={() => setShowWhatsAppPopup(false)}
                                    className="w-full py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 text-gray-500 dark:text-gray-400 font-black uppercase text-[10px] tracking-widest transition-colors"
                                >
                                    Done, I've Uploaded It
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-10 max-w-5xl mx-auto pb-16 px-2 sm:px-4">
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

            <div className="p-4 sm:p-8 md:p-10 text-white shadow-xl relative overflow-hidden mb-4 sm:mb-12 group transition-all" style={{ backgroundColor: pageConfig.primaryColor, borderRadius: pageConfig.cardRounding }}>
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-2 sm:mb-4 tracking-tighter uppercase leading-none">Deposit Funds</h1>
                    <p className="text-blue-50 text-xs sm:text-sm md:text-base max-w-2xl leading-relaxed font-medium">Add funds to your wallet securely. Follow the sequence to complete your deposit.</p>
                </div>
            </div>

            <StepIndicator currentStep={step} primaryColor={pageConfig.primaryColor} />

            <div className="bg-white dark:bg-gray-950 p-4 sm:p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-800" style={{ borderRadius: pageConfig.cardRounding }}>
                {step === 1 && (
                    <div className="animate-fade-in space-y-4 sm:space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-1 mb-2 sm:mb-6">
                            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">Amount Selection</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">Select an amount based on active plan pricing</p>
                        </div>
                        {planPrices.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-3">
                                {planPrices.map(price => (
                                    <button
                                        key={price}
                                        type="button"
                                        onClick={() => setAmount(price.toString())}
                                        className={`py-2.5 px-2 sm:py-4 sm:px-4 rounded-lg sm:rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-wider sm:tracking-widest transition-all border-2`}
                                        style={{ 
                                            backgroundColor: amount === price.toString() ? pageConfig.primaryColor : 'transparent',
                                            color: amount === price.toString() ? '#fff' : '#6b7280',
                                            borderColor: amount === price.toString() ? pageConfig.primaryColor : 'rgba(0,0,0,0.05)',
                                            boxShadow: amount === price.toString() ? `0 10px 15px -3px ${pageConfig.primaryColor}33` : 'none'
                                        }}
                                    >
                                        {formatCurrency(price, currentUser.currency)}
                                    </button>
                                ))}
                            </div>
                        )}



                        <Button 
                            onClick={() => setStep(2)} 
                            disabled={!amount || parseFloat(amount) <= 0}
                            className="w-full py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl"
                            style={{ backgroundColor: pageConfig.primaryColor }}
                        >
                            Next Step &rarr;
                        </Button>
                    </div>
                )}
                
                {step === 2 && (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        <div className="text-center space-y-1 mb-2 sm:mb-4 animate-fade-in">
                            <h3 className="text-base sm:text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">Choose payment provider</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">Step 2: Select a payment method matching {formatCurrency(parseFloat(amount), currentUser.currency)}</p>
                        </div>
                        {availableMethods.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl animate-fade-in">
                                <p className="text-xs font-bold text-gray-400 uppercase">No active methods for this amount</p>
                                <button onClick={() => setStep(1)} className="mt-3 px-4 py-2 bg-blue-600 text-white font-black uppercase tracking-wider text-[10px] rounded-xl hover:bg-blue-700 transition-colors">Adjust Amount</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 sm:gap-4 animate-fade-in">
                                {availableMethods.map(m => (
                                    <div 
                                        key={m._id} 
                                        onClick={() => { setSelectedMethodId(m._id); setStep(3); }} 
                                        className="p-2 sm:p-4 border-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-98 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-900 border-gray-150/50 dark:border-gray-800 hover:border-blue-500 shadow-sm hover:shadow-md flex flex-col sm:flex-row items-center text-center sm:text-left gap-2 sm:gap-3.5"
                                    >
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-white border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-center p-1 sm:p-1.5 shadow-sm">
                                            <img src={m.logoUrl} className="max-w-full max-h-full object-contain" alt={m.name} />
                                        </div>
                                        <div className="flex-grow min-w-0 w-full">
                                            <h4 className="font-black uppercase text-[10px] sm:text-sm tracking-tight text-gray-950 dark:text-white truncate">{m.name}</h4>
                                            {m.feePercent > 0 && (
                                                <p className="text-[8px] sm:text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                                                    Fee: {m.feePercent}%
                                                </p>
                                            )}
                                            <span className="text-[8px] sm:text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1 block">Click to select &rarr;</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                            <button onClick={() => setStep(1)} className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-400 hover:text-blue-500 transition-colors">&larr; Back to Amount</button>
                        </div>
                    </div>
                )}

                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-3 sm:space-y-6 max-w-2xl mx-auto">
                        <div className="text-center space-y-1">
                            <h2 className="text-2xl sm:text-4xl font-black mb-0.5" style={{ color: pageConfig.primaryColor }}>{formatCurrency(parseFloat(amount), currentUser.currency)}</h2>
                            <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Destination Instructions</p>
                        </div>

                        {/* HIGHLY CLEAR PAYMENT WARNING MESSAGE */}
                        <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-center">
                            <p className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-400 leading-normal">
                                ⚠️ <strong>Action Required:</strong> Please send exactly <strong className="text-xs sm:text-base font-black text-amber-800 dark:text-amber-300 underline">{formatCurrency(parseFloat(amount), currentUser.currency)}</strong> using <strong>{selectedMethod.name}</strong> to the account details below.
                            </p>
                        </div>

                        {selectedMethod.gatewayMode === 'paynow' ? (
                            <div className="p-3.5 sm:p-6 bg-[#0f172a] rounded-xl sm:rounded-3xl text-white space-y-4 shadow-xl border border-white/5 flex flex-col items-center">
                                {/* ENLARGED LOGO AND PROVIDER NAME */}
                                <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 w-full text-center gap-3">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center p-2 shadow-inner">
                                        <img src={selectedMethod.logoUrl} className="max-w-full max-h-full object-contain" alt={selectedMethod.name} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-base sm:text-xl font-black uppercase text-white tracking-tight">{selectedMethod.name}</h3>
                                        <span className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest block">Checkout Gateway Mode</span>
                                    </div>
                                </div>

                                <div className="space-y-1 text-center">
                                    <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight">
                                        {selectedMethod.gatewayTitle || 'Checkout Payment Gateway'}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                                        {selectedMethod.gatewayDescription ? (
                                            <Linkify text={selectedMethod.gatewayDescription} primaryColor={pageConfig.primaryColor} />
                                        ) : (
                                            <>
                                                Click below to pay safely using your <strong>PayPal</strong>, <strong>Stripe</strong> checkout system, or <strong>Credit Card</strong>.
                                            </>
                                        )}
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-lg pt-1 justify-center">
                                    <a
                                        href={selectedMethod.payNowUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 font-black uppercase tracking-wider text-[10px] sm:text-xs text-center py-3 sm:py-4 rounded-xl text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 bg-[#10b981]"
                                    >
                                        <span>💳</span> {selectedMethod.payNowButtonText || 'Pay Now'}
                                        <ExternalLinkIcon />
                                    </a>

                                    {selectedMethod.isPopupViewEnabled && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPayNowModalOpen(true)}
                                            className="flex-1 py-3 sm:py-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700 hover:text-white hover:scale-[1.02] active:scale-95 transition-all text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                                        >
                                            <span>💡</span> Verification Steps
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 sm:p-6 bg-[#0f172a] rounded-xl sm:rounded-3xl text-white space-y-4 shadow-xl border border-white/5">
                                {/* ENLARGED LOGO AND PROVIDER NAME & ACCOUNT TITLE COHESIVELY */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-center bg-white/5 p-3.5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-md">
                                            <img src={selectedMethod.logoUrl} className="max-w-full max-h-full object-contain" alt={selectedMethod.name} />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <p className="text-[8px] sm:text-[9px] uppercase text-gray-400 font-black tracking-widest mb-0.5">
                                                {selectedMethod.customLabels?.providerLabel || 'Payment Provider'}
                                            </p>
                                            <h3 className="text-sm sm:text-lg font-black text-white leading-tight truncate">{selectedMethod.name}</h3>
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                                        <p className="text-[8px] sm:text-[9px] uppercase text-gray-400 font-black tracking-widest mb-0.5 text-left">
                                            {selectedMethod.customLabels?.accountTitleLabel || 'Account Title'}
                                        </p>
                                        <p className="text-xs sm:text-sm font-bold text-white text-left truncate">{selectedMethod.accountTitle}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-1">
                                    {/* ACCOUNT MAIN INFO */}
                                    <div className="space-y-4 flex-grow w-full">
                                        <div>
                                            <p className="text-[8px] sm:text-[9px] uppercase text-gray-400 font-black tracking-widest mb-1.5 text-left">
                                                {selectedMethod.customLabels?.accountNumberLabel || 'Account / Wallet Number'}
                                            </p>
                                            <div className="flex items-center justify-between p-3 bg-black/50 rounded-xl border border-white/5 shadow-inner min-w-0 w-full">
                                                <p className="text-xs sm:text-lg font-black font-mono text-blue-400 select-all whitespace-nowrap overflow-x-auto scrollbar-none min-w-0 flex-1 mr-2">{selectedMethod.accountNumber}</p>
                                                <button onClick={() => handleCopy(selectedMethod.accountNumber)} className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0 shadow">
                                                    <svg className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* DYNAMIC EXTRA FIELDS */}
                                        {selectedMethod.customFields && selectedMethod.customFields.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[8px] uppercase text-gray-400 font-black tracking-widest border-b border-white/5 pb-1 text-left">Supplementary Details</p>
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {selectedMethod.customFields.map((field, idx) => (
                                                        <div key={idx} className="group">
                                                            <p className="text-[8px] uppercase text-gray-400 font-black tracking-widest mb-0.5 opacity-80 group-hover:text-blue-400 transition-colors truncate text-left">{field.title}</p>
                                                            <div className="flex items-center justify-between bg-black/30 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                                                                <p className="text-[11px] sm:text-xs font-bold text-gray-100 truncate pr-1">{field.value}</p>
                                                                <button onClick={() => handleCopy(field.value)} className="p-1 text-gray-500 hover:text-blue-400 transition-colors shrink-0">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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
                                        <div className="shrink-0 flex flex-col items-center gap-1.5 bg-white p-2.5 rounded-xl shadow border border-gray-100 mx-auto w-full max-w-[140px] sm:max-w-[160px]">
                                            <img src={selectedMethod.qrCodeUrl} alt="Scan to Pay" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                                            <span className="text-[8px] sm:text-[9px] font-black uppercase text-gray-400 tracking-wider">Scan to Pay</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SPECIAL INSTRUCTIONS WITH LINK DETECTION */}
                        {selectedMethod.instructions && (
                            <div className="p-3.5 sm:p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl sm:rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-base sm:text-lg">💡</span>
                                    <h4 className="font-black text-[10px] sm:text-xs uppercase text-amber-700 dark:text-amber-500 tracking-widest">Admin Advisory & Instructions</h4>
                                </div>
                                <div className="text-gray-700 dark:text-gray-300 font-bold text-xs sm:text-sm leading-relaxed text-left">
                                    <Linkify text={selectedMethod.instructions} primaryColor={pageConfig.primaryColor} />
                                </div>
                            </div>
                        )}

                        {/* HOW TO GUIDE INNER SLIDER */}
                        {selectedMethod.howToDeposit?.enabled && selectedMethod.howToDeposit.steps?.length > 0 && (
                            <div className="space-y-4 sm:space-y-6">
                                {selectedMethod.howToDeposit?.dropdownMode ? (
                                    /* Collapsible Dropdown Mode */
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-[2.5rem] p-1.5 sm:p-2 bg-slate-50/40 dark:bg-slate-950/20 overflow-hidden shadow-sm transition-all pb-2 sm:pb-4">
                                        <div 
                                            onClick={() => setIsGuideExpanded(!isGuideExpanded)}
                                            className="flex items-center justify-between p-3 sm:p-5 bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-all select-none shadow-sm"
                                        >
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <span className="text-2xl sm:text-3xl">📖</span>
                                                <div className="text-left">
                                                    <h3 className="text-xs sm:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                        Process Guide
                                                        <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 dark:bg-blue-500/10">dropdown</span>
                                                    </h3>
                                                    <p className="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                                        {isGuideExpanded ? 'Click to minimize tutorial' : 'Click to maximize tutorial'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsGuideOpen(true);
                                                    }}
                                                    className="hidden sm:inline-flex px-3 py-1.5 rounded-xl border border-gray-150 dark:border-slate-800 text-[9px] uppercase font-black tracking-wider text-slate-500 hover:text-blue-500 transition-colors bg-white dark:bg-slate-900 shadow-sm"
                                                >
                                                    🔎 Fullscreen
                                                </button>
                                                <div className={`p-1.5 sm:p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform duration-300 ${isGuideExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                                    <svg className="w-4 h-4 sm:w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>

                                        {isGuideExpanded && (
                                            <div className="p-2 sm:p-4 pt-3 sm:pt-6 animate-fade-in">
                                                <HowToDepositSlider 
                                                    steps={selectedMethod.howToDeposit.steps} 
                                                    primaryColor={pageConfig.primaryColor}
                                                    onFinish={() => setStep(4)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Traditional Fully Shown Mode */
                                    <div className="space-y-4 sm:space-y-6">
                                        <div className="flex items-center justify-between px-1 sm:px-2">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <span className="text-2xl sm:text-3xl">📖</span>
                                                <div>
                                                    <h3 className="text-sm sm:text-xl font-black uppercase tracking-tight text-slate-905 dark:text-white-100">Step-by-Step Process Guide</h3>
                                                    <p className="text-[9px] sm:text-xs text-slate-400 font-semibold">Slide through the direct visual guidelines to transfer correctly.</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setIsGuideOpen(true)}
                                                className="hidden sm:inline-flex px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500 hover:text-blue-500 transition-colors bg-white dark:bg-slate-900 shadow-sm"
                                            >
                                                🔎 Fullscreen Mode
                                            </button>
                                        </div>
                                        
                                        <HowToDepositSlider 
                                            steps={selectedMethod.howToDeposit.steps} 
                                            primaryColor={pageConfig.primaryColor}
                                            onFinish={() => setStep(4)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button onClick={() => setStep(2)} className="flex-1 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs text-gray-400 hover:text-blue-600 transition-colors">Return to Methods</button>
                            <Button className="flex-[2] py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl shadow-blue-500/20" onClick={() => setStep(4)} style={{ backgroundColor: pageConfig.primaryColor }}>I have completed payment &rarr;</Button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8 animate-fade-in max-w-2xl mx-auto">
                        <div className="text-center space-y-1 mb-2 sm:mb-6">
                            <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tighter text-gray-800 dark:text-white">Audit Submission</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">Step 4: Final verification and proof</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-1.5 ml-2">Sender Account Name</label>
                                <input className="w-full p-3.5 sm:p-5 rounded-xl sm:rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm" placeholder="TITLE OF YOUR SENDER ACCOUNT" value={senderAccountTitle} onChange={e => setSenderAccountTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-1.5 ml-2">Digital ID (Transaction ID)</label>
                                <input className="w-full p-3.5 sm:p-5 rounded-xl sm:rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm" placeholder="REFERENCE NUMBER FROM SLIP" value={transactionId} onChange={e => setTransactionId(e.target.value)} required />
                            </div>
                            
                            {/* Dynamic Confirmation Fields */}
                            {selectedMethod?.confirmationFields && selectedMethod.confirmationFields.length > 0 && (
                                <div className="space-y-4 pt-1 sm:pt-2">
                                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3 sm:pt-4">
                                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-500 block mb-1">Additional Information Required</span>
                                    </div>
                                    {selectedMethod.confirmationFields.map((field, idx) => (
                                        <div key={idx}>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-1.5 ml-2">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <input 
                                                type={field.type || 'text'}
                                                className="w-full p-3.5 sm:p-5 rounded-xl sm:rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm" 
                                                placeholder={field.placeholder || `ENTER YOUR ${field.label.toUpperCase()}`}
                                                value={confirmationAnswers[field.label] || ''}
                                                onChange={e => setConfirmationAnswers(prev => ({ ...prev, [field.label]: e.target.value }))}
                                                required={!!field.required}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-1.5 ml-2">Verification Proof (Screenshot)</label>
                                <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl sm:rounded-[2rem] p-4 sm:p-10 text-center bg-gray-50 dark:bg-gray-900/30 group hover:border-blue-500 transition-colors">
                                    <input type="file" id="receipt" className="hidden" onChange={e => e.target.files && setReceipt(e.target.files[0])} required />
                                    <label htmlFor="receipt" className="cursor-pointer">
                                        {receipt ? (
                                            <div className="flex flex-col items-center gap-1 sm:gap-2">
                                                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 text-sm sm:text-base">✓</div>
                                                <span className="text-xs font-bold text-green-600 truncate max-w-xs">{receipt.name}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 sm:gap-2">
                                                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 text-sm sm:text-base">📁</div>
                                                <span className="text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-wider">Click to Select Receipt</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                            
                            {whatsappLink && settings?.whatsappDepositProofEnabled !== false && (
                                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.63-1.019-5.101-2.871-6.955C16.6 1.93 14.124.912 11.493.912c-5.438 0-9.863 4.42-9.866 9.865-.001 1.745.457 3.447 1.328 4.966L1.93 21.054l5.428-1.424-.711-.476zm11.01-6.17c-.31-.156-1.84-.908-2.126-1.012-.287-.104-.496-.156-.705.156-.209.312-.81 1.012-.992 1.22-.183.208-.365.234-.675.078-.31-.156-1.31-.48-2.493-1.537-.92-.818-1.54-1.83-1.72-2.14-.18-.31-.019-.477.136-.631.14-.139.31-.362.465-.544.155-.181.206-.31.31-.518.104-.208.052-.389-.026-.544-.078-.156-.705-1.7-.966-2.327-.254-.61-.514-.528-.705-.528-.183 0-.391-.012-.6-.012s-.548.078-.835.39c-.287.313-1.096 1.072-1.096 2.614 0 1.54 1.121 3.03 1.277 3.238.156.208 2.207 3.37 5.348 4.729.747.323 1.33.516 1.784.66.751.238 1.436.204 1.977.123.602-.09 1.84-.753 2.1-1.443.26-.69.26-1.282.182-1.403-.078-.12-.286-.19-.597-.346z" />
                                        </svg>
                                        <span className="font-black text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fast Approval Step</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold leading-relaxed">
                                        Customer must upload screenshot of deposit funds after all steps on the WhatsApp support number for super fast approval.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button type="button" onClick={() => setStep(3)} className="py-3 sm:py-5 px-4 rounded-xl sm:rounded-2xl font-black uppercase text-[11px] sm:text-xs text-gray-400 hover:text-blue-600 transition-colors">Back to Details</button>
                            <Button type="submit" disabled={isSubmitting} className="flex-[2] py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl shadow-blue-500/20" style={{ backgroundColor: pageConfig.primaryColor }}>{isSubmitting ? 'Transmitting Data...' : pageConfig.buttonText}</Button>
                        </div>
                    </form>
                )}
            </div>

            {/* DEPOSIT HISTORY SECTION (Audit Log) */}
            <div className="bg-white dark:bg-gray-950 p-4 sm:p-10 rounded-2xl sm:rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-6 sm:mt-12">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-10 gap-4 sm:gap-6">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">History Log</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto items-stretch sm:items-center">
                        <div className="flex items-center gap-2 justify-between bg-gray-50/50 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800/80">
                            <label className="text-[10px] font-black uppercase text-gray-400">Show:</label>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="rounded-lg bg-transparent border-none dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-0 py-0.5 px-1.5 cursor-pointer outline-none"
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
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-2 sm:py-2.5 px-3 outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center justify-between gap-1 bg-gray-50 dark:bg-gray-900 p-1.5 sm:p-2 rounded-xl border border-gray-100 dark:border-gray-800 min-w-0">
                            <input 
                                type="date" 
                                value={historyDateFrom} 
                                onChange={(e) => setHistoryDateFrom(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[9px] sm:text-[10px] font-black uppercase focus:ring-0 p-0 outline-none w-[90px] sm:w-auto" 
                            />
                            <span className="text-gray-350 dark:text-gray-700 text-[10px] px-1">|</span>
                            <input 
                                type="date" 
                                value={historyDateTo} 
                                onChange={(e) => setHistoryDateTo(e.target.value)} 
                                className="bg-transparent border-none dark:text-white text-[9px] sm:text-[10px] font-black uppercase focus:ring-0 p-0 outline-none w-[90px] sm:w-auto" 
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
                        <div className="md:hidden space-y-2.5">
                            {paginatedDeposits.map(deposit => (
                                <div key={deposit._id} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300">
                                    <div 
                                        className="p-3 flex items-center justify-between cursor-pointer"
                                        onClick={() => setExpandedDepositId(expandedDepositId === deposit._id ? null : deposit._id)}
                                    >
                                        <div className="flex flex-col min-w-0 flex-1 mr-2">
                                            <span className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{deposit.method}</span>
                                            <span className="text-xs sm:text-sm font-black text-gray-900 dark:text-white truncate">{formatCurrency(deposit.amount, deposit.currency)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge status={deposit.status as Status} />
                                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-blue-500 transition-transform shadow-sm ${expandedDepositId === deposit._id ? 'rotate-180' : ''}`}>
                                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {expandedDepositId === deposit._id && (
                                        <div className="p-3 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Date</p>
                                                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{new Date(deposit.date).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Transaction ID</p>
                                                    <p className="text-[11px] font-mono font-bold text-blue-500 break-all select-all">{deposit.transactionId}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sender Account</p>
                                                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{deposit.senderAccountTitle || 'Pending Data'}</p>
                                                </div>
                                                {deposit.confirmationAnswers && Object.keys(deposit.confirmationAnswers).length > 0 && (
                                                    <div className="col-span-2 pt-1.5 border-t dark:border-gray-800 space-y-1.5">
                                                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-indigo-500">Submitted Proof Details</p>
                                                        <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border dark:border-slate-800">
                                                            {Object.entries(deposit.confirmationAnswers).map(([label, value]) => (
                                                                <div key={label} className="min-w-0">
                                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest truncate">{label}</p>
                                                                    <p className="text-[11px] font-bold text-gray-750 dark:text-gray-200 break-all font-sans">{String(value)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {deposit.notes && (
                                                    <div className="col-span-2 pt-1.5 border-t dark:border-gray-800">
                                                        <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Admin Notes</p>
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
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 sm:mt-8 gap-3 sm:gap-4 border-t dark:border-gray-800 pt-3 sm:pt-6">
                            <div className="text-[9px] sm:text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                Page {currentPage} of {totalPages || 1} ({totalItems} records)
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 font-black uppercase text-[9px] sm:text-[10px] tracking-widest"
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
                                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black transition-all ${
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
                                    className="rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 font-black uppercase text-[9px] sm:text-[10px] tracking-widest"
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

            {/* PAY NOW POPUP INSTRUCTIONS MODAL */}
            {isPayNowModalOpen && selectedMethod && (
                <Modal isOpen={isPayNowModalOpen} onClose={() => setIsPayNowModalOpen(false)}>
                    <div className="relative w-[95vw] max-w-lg bg-white dark:bg-gray-950 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 md:p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-fade-in select-none">
                        <div className="flex justify-between items-center mb-4 sm:mb-6">
                            <h3 className="text-base sm:text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                                <span className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-500 text-sm sm:text-lg flex items-center justify-center">💡</span>
                                {selectedMethod.popupViewTitle || 'Payment Instructions'}
                            </h3>
                            <button onClick={() => setIsPayNowModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* ILLUSTRATIVE TRANSACT RECEIPT BOX */}
                        <div className="bg-slate-50 dark:bg-slate-900 p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center flex flex-col items-center gap-1 sm:gap-2 mb-4 sm:mb-6">
                            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-emerald-500/10 text-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl">📸</div>
                            <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">Screenshot Proof Expected</h4>
                            <p className="text-[9px] sm:text-[11px] text-gray-400 max-w-xs leading-normal">
                                First click the main green <strong>"{selectedMethod.payNowButtonText || 'Pay Now'}"</strong> button to complete checkout, then snap a screenshot of our merchant's receipt.
                            </p>
                        </div>

                        {/* ENTER EMAIL INPUT */}
                        <div className="space-y-1.5 mb-4 sm:mb-6">
                            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Your PayPal / Stripe registered email
                            </label>
                            <input
                                type="email"
                                value={senderAccountTitle}
                                onChange={(e) => setSenderAccountTitle(e.target.value)}
                                placeholder="e.g. name@example.com"
                                className="w-full px-3.5 py-2.5 sm:px-5 sm:py-4 rounded-xl text-xs sm:text-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none font-bold transition-all text-gray-900 dark:text-white"
                            />
                            <span className="text-[9px] sm:text-[10px] text-gray-400 block leading-normal pt-0.5">
                                We will pre-populate your auditing sender field with this email address.
                            </span>
                        </div>

                        {/* ADVISORY STEPS */}
                        <div className="p-3 sm:p-5 bg-blue-50 dark:bg-blue-950/20 rounded-xl sm:rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-4 sm:mb-6 text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-bold space-y-1.5">
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 uppercase font-black text-[9px] sm:text-[10px] tracking-widest mb-0.5">
                                <span>📋 Instruction steps</span>
                            </div>
                            <Linkify text={selectedMethod.popupViewInstructions || 'Please complete checkout payment, input your email, capture proof and proceed.'} primaryColor={pageConfig.primaryColor} />
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-2.5 sm:gap-4 pt-1 sm:pt-2">
                            <button 
                                onClick={() => setIsPayNowModalOpen(false)} 
                                className="flex-1 py-2.5 sm:py-4 bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
                            >
                                Cancel
                            </button>
                            <Button
                                onClick={() => {
                                    setIsPayNowModalOpen(false);
                                    setStep(4);
                                }}
                                className="flex-[2] py-2.5 sm:py-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-white"
                                style={{ backgroundColor: pageConfig.primaryColor }}
                            >
                                I Have Paid, Next Step &rarr;
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* HOW TO GUIDE MODAL */}
            {isGuideOpen && selectedMethod?.howToDeposit?.steps && (
                <Modal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)}>
                    <div className="relative w-[95vw] max-w-4xl bg-white dark:bg-gray-950 rounded-2xl sm:rounded-[3rem] p-4 sm:p-6 md:p-10 shadow-2xl border border-slate-150 dark:border-slate-800 flex flex-col gap-3 sm:gap-6 overflow-hidden select-none animate-fade-in">
                        <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3 sm:pb-4">
                            <div>
                                <h3 className="text-base sm:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
                                    <span className="p-1.5 sm:p-2.5 bg-blue-500/10 text-blue-500 text-sm sm:text-lg rounded-xl sm:rounded-2xl flex items-center justify-center">📖</span>
                                    How To Transfer Guide
                                </h3>
                                <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Completing transfer via {selectedMethod.name}</p>
                            </div>
                            <button onClick={() => setIsGuideOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 sm:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <HowToDepositSlider
                            steps={selectedMethod.howToDeposit.steps}
                            primaryColor={pageConfig.primaryColor}
                            onFinish={() => setIsGuideOpen(false)}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default DepositFunds;
