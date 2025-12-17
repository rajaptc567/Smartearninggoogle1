import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import Button from '../components/ui/Button';
import { updateSettings } from '../services/api';
import { InvestmentPlan, HomepageContent, FaqItem, formatCurrency } from '../types';

// Icons
const GenericPaymentIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const SecureIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const NetworkIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const GrowthIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const UsdIcon = () => <span className="text-3xl font-bold">$</span>;
const EurIcon = () => <span className="text-3xl font-bold">€</span>;
const PkrIcon = () => <span className="text-3xl font-bold">₨</span>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const PlusIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;

// Helper Components
const EditBar: React.FC<{ onSave: () => void; onExit: () => void; isSaving: boolean; isDirty: boolean }> = ({ onSave, onExit, isSaving, isDirty }) => (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-50 flex justify-between items-center animate-slide-up">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {isDirty ? 'You have unsaved changes.' : 'Editing Mode Active'}
        </div>
        <div className="flex gap-4">
            <Button variant="secondary" onClick={onExit}>Exit</Button>
            <Button onClick={onSave} disabled={isSaving || !isDirty}>
                {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
    </div>
);

interface EditableTextProps {
    editMode: boolean;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
    multiline?: boolean;
    className?: string;
}

const EditableText: React.FC<EditableTextProps> = ({ editMode, value, onChange, tag: Tag = 'div', multiline = false, className = '' }) => {
    if (editMode) {
        if (multiline) {
            return (
                <textarea 
                    value={value} 
                    onChange={onChange} 
                    className={`w-full bg-yellow-50 dark:bg-yellow-900/10 border border-dashed border-yellow-300 dark:border-yellow-700 rounded p-2 focus:ring-2 focus:ring-yellow-400 focus:outline-none ${className}`} 
                    rows={3}
                />
            );
        }
        return (
            <input 
                type="text" 
                value={value} 
                onChange={onChange} 
                className={`w-full bg-yellow-50 dark:bg-yellow-900/10 border border-dashed border-yellow-300 dark:border-yellow-700 rounded p-1 focus:ring-2 focus:ring-yellow-400 focus:outline-none ${className}`} 
            />
        );
    }
    return <Tag className={className}>{value}</Tag>;
};

const MLMDiagram = () => (
    <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg z-10 relative">You</div>
        <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
        <div className="w-64 h-0.5 bg-gray-300 dark:bg-gray-600 relative">
            <div className="absolute left-0 top-0 w-0.5 h-4 bg-gray-300 dark:bg-gray-600 transform -translate-y-full"></div> {/* Correction for line connection */}
        </div>
        <div className="flex justify-between w-80 -mt-0.5"> {/* Overlap slightly */}
             <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">L1</div>
                <div className="h-4 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="w-24 border-t border-gray-300 dark:border-gray-600"></div>
                <div className="flex justify-between w-24">
                    <div className="flex flex-col items-center">
                        <div className="h-4 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs shadow-sm">L2</div>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="h-4 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs shadow-sm">L2</div>
                    </div>
                </div>
             </div>
             
             <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">L1</div>
             </div>

             <div className="flex flex-col items-center">
                <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">L1</div>
                <div className="h-4 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs shadow-sm">L2</div>
             </div>
        </div>
    </div>
);

// Reusable Payment Method Card Component
const PaymentMethodCard: React.FC<{ pm: { name: string, logoUrl?: string, size?: 'small' | 'medium' | 'large', zoom?: number }; colorStyle: string }> = ({ pm, colorStyle }) => {
    const sizeClasses = {
        small: 'w-32 h-24 md:w-36 md:h-28 p-3',
        medium: 'w-40 h-32 md:w-48 md:h-36 p-4',
        large: 'w-56 h-40 md:w-64 md:h-48 p-6'
    };
    
    const imgHeightClass = {
        small: 'h-10 md:h-12',
        medium: 'h-14 md:h-16',
        large: 'h-20 md:h-24'
    };

    const currentSize = pm.size || 'medium';
    const zoomScale = (pm.zoom || 100) / 100;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-105 hover:shadow-md group overflow-hidden ${sizeClasses[currentSize]}`}>
            {pm.logoUrl ? (
                <div className={`w-full flex items-center justify-center mb-2 md:mb-3 ${imgHeightClass[currentSize]} ${colorStyle === 'grayscale' ? 'grayscale group-hover:grayscale-0' : ''} transition-all duration-300`}>
                    <img 
                        src={pm.logoUrl} 
                        alt={pm.name} 
                        className="max-w-full max-h-full object-contain transition-transform duration-300" 
                        style={{ transform: `scale(${zoomScale})` }}
                        title={pm.name} 
                    />
                </div>
            ) : (
                <div className={`w-12 h-12 md:w-16 md:h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3 text-gray-400`}>
                    <GenericPaymentIcon />
                </div>
            )}
            <span className={`font-semibold text-gray-700 dark:text-gray-300 text-center relative z-10 ${currentSize === 'small' ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'}`}>{pm.name}</span>
        </div>
    );
};

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useData();
    const { settings, investmentPlans, currentUser } = state;

    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [pageContent, setPageContent] = useState<Partial<HomepageContent>>(settings.homepageContent || {});
    const [videoUrl, setVideoUrl] = useState(settings.homepageVideoUrl || '');
    const [localFaqs, setLocalFaqs] = useState<FaqItem[]>([]);

    useEffect(() => {
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const params = new URLSearchParams(hash.substring(queryIndex));
            if (params.get('edit') === 'true' && currentUser?.username === 'admin') {
                setEditMode(true);
            }
        }
    }, [currentUser]);

     useEffect(() => {
        setPageContent(settings.homepageContent || {});
        setVideoUrl(settings.homepageVideoUrl || '');
        setLocalFaqs(settings.faqs || []);
        setIsDirty(false);
    }, [settings]);

    const handleContentChange = (field: keyof HomepageContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setPageContent(prev => ({ ...prev, [field]: e.target.value }));
        setIsDirty(true);
    };
    
    // Explicitly for select changes
    const handleSelectChange = (field: keyof HomepageContent) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        setPageContent(prev => ({ ...prev, [field]: e.target.value }));
        setIsDirty(true);
    };

    const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVideoUrl(e.target.value);
        setIsDirty(true);
    };

    // --- FAQ Handlers ---
    const handleFaqChange = (index: number, field: keyof FaqItem, value: string) => {
        const updatedFaqs = [...localFaqs];
        updatedFaqs[index] = { ...updatedFaqs[index], [field]: value };
        setLocalFaqs(updatedFaqs);
        setIsDirty(true);
    };

    const handleAddFaq = () => {
        setLocalFaqs([...localFaqs, { question: 'New Question', answer: 'New Answer' }]);
        setIsDirty(true);
    };

    const handleDeleteFaq = (index: number) => {
        if(window.confirm('Are you sure you want to delete this FAQ?')) {
            const updatedFaqs = localFaqs.filter((_, i) => i !== index);
            setLocalFaqs(updatedFaqs);
            setIsDirty(true);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedSettings = { 
                ...settings, 
                homepageContent: pageContent as HomepageContent,
                homepageVideoUrl: videoUrl,
                faqs: localFaqs
            };
            const savedSettings = await updateSettings(updatedSettings);
            dispatch({ type: 'UPDATE_SETTINGS', payload: savedSettings });
            alert('Homepage content saved successfully!');
            setIsDirty(false);
        } catch (error) {
            console.error('Failed to save content:', error);
            alert('Error saving content.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const exitEditMode = () => {
        setEditMode(false);
        // Remove ?edit=true from URL
        const newUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', newUrl);
    };

    const featuredPlans = useMemo(() => {
        const featuredIds = settings.featuredPlanIds;
        if (featuredIds && featuredIds.length > 0) {
            // Create a map for quick lookup
            const planMap = new Map(investmentPlans.map(p => [p._id, p]));
            
            // Map IDs to plan objects, filtering for active ones and preserving order
            return featuredIds
                .map(id => planMap.get(id))
                .filter((p): p is InvestmentPlan => !!(p && p.status === 'Active'));
        }
        
        // Fallback: Pick one active plan from each currency if possible, up to 3 total.
        const fallbackPlans: InvestmentPlan[] = [];
        const usdPlan = investmentPlans.find(p => p.currency === 'USD' && p.status === 'Active');
        if (usdPlan) fallbackPlans.push(usdPlan);
        
        const eurPlan = investmentPlans.find(p => p.currency === 'EUR' && p.status === 'Active');
        if (eurPlan && fallbackPlans.length < 3) fallbackPlans.push(eurPlan);
        
        const pkrPlan = investmentPlans.find(p => p.currency === 'PKR' && p.status === 'Active');
        if (pkrPlan && fallbackPlans.length < 3) fallbackPlans.push(pkrPlan);

        // If we still don't have any/enough plans, fall back to just the first 3 active plans globally
        if (fallbackPlans.length === 0) {
            return investmentPlans.filter(p => p.status === 'Active').slice(0, 3);
        }

        return fallbackPlans;
    }, [investmentPlans, settings.featuredPlanIds]);

    const renderDirectCommission = (plan: InvestmentPlan) => {
      const comms = plan.directCommissions;
      if (!comms || comms.length === 0) return 'N/A';
      let maxVal = 0, maxType: 'percentage' | 'fixed' = 'percentage';
      comms.forEach(c => {
          if (c.value > maxVal) { maxVal = c.value; maxType = c.type; }
      });
      const valStr = maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
      return comms.length > 1 ? `Up to ${valStr}` : valStr;
    };

    // Filter distinct active payment methods
    const activePaymentMethods = useMemo(() => {
        return settings.homepagePaymentLogos || [];
    }, [settings.homepagePaymentLogos]);
    
    // Animation/Style Config
    const pmDisplayType = (pageContent as any).paymentMethodsDisplayType || 'static';
    const pmColorStyle = (pageContent as any).paymentMethodsColorStyle || 'color';
    
    // Duplicate array for seamless sliding animation
    const slidingMethods = useMemo(() => {
        if (activePaymentMethods.length === 0) return [];
        if (activePaymentMethods.length < 10) {
            // If few methods, duplicate enough times to fill a potentially wide screen
            return [...activePaymentMethods, ...activePaymentMethods, ...activePaymentMethods, ...activePaymentMethods];
        }
        return [...activePaymentMethods, ...activePaymentMethods];
    }, [activePaymentMethods]);

    // SECTION VISIBILITY FLAGS
    // Using loose equality check !== false to default to true if undefined
    const showHero = settings.homepageContent?.showHero !== false;
    const showFeatures = settings.homepageContent?.showFeatures !== false;
    const showMultiCurrency = settings.homepageContent?.showMultiCurrency !== false;
    const showInvestmentPlans = settings.homepageContent?.showInvestmentPlans !== false;
    const showMLM = settings.homepageContent?.showMLM !== false;
    const showPaymentMethods = settings.homepageContent?.showPaymentMethods !== false;
    const showVideoSection = settings.homepageContent?.showVideoSection !== false;
    const showFAQ = settings.homepageContent?.showFAQ !== false;
    const showCTA = settings.homepageContent?.showCTA !== false;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans">
            <style>
                {`
                @keyframes slide-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-slide {
                    animation: slide-left 25s linear infinite;
                }
                .animate-slide:hover {
                    animation-play-state: paused;
                }
                `}
            </style>
            
            {editMode && <EditBar onSave={handleSave} onExit={exitEditMode} isSaving={isSaving} isDirty={isDirty}/>}

            {/* Header */}
            <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-all">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg"></div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">SmartEarning</h1>
                        </div>
                        <nav className="hidden md:flex items-center space-x-2">
                            {currentUser ? (
                                <>
                                    <Button variant="secondary" onClick={() => navigate('/member')}>Dashboard</Button>
                                    {currentUser.username === 'admin' && (
                                        <Button onClick={() => setEditMode(!editMode)}>
                                            {editMode ? 'Exit Edit' : 'Edit Page'}
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Button variant="secondary" onClick={() => navigate('/login')}>Login</Button>
                                    <Button onClick={() => navigate('/register')}>Sign Up</Button>
                                </>
                            )}
                        </nav>
                        <div className="md:hidden flex gap-2">
                             {currentUser ? (
                                <Button size="sm" onClick={() => navigate('/member')}>Dashboard</Button>
                            ) : (
                                <Button size="sm" onClick={() => navigate('/login')}>Login</Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                {(showHero || editMode) && (
                    <section className={`relative py-24 md:py-32 text-center overflow-hidden bg-white dark:bg-gray-900 ${!showHero && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showHero && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-gray-900"></div>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <EditableText editMode={editMode} value={pageContent.heroTitle || ''} onChange={handleContentChange('heroTitle')} tag="h2" className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6 leading-tight" />
                            <EditableText editMode={editMode} value={pageContent.heroSubtitle || ''} onChange={handleContentChange('heroSubtitle')} tag="p" multiline className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed" />
                            <div className="mt-10 flex justify-center gap-4">
                                <Button size="lg" onClick={() => navigate('/register')} className="shadow-xl shadow-blue-500/20 px-8 py-4 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0">Start Earning</Button>
                                <Button size="lg" variant="secondary" onClick={() => {document.getElementById('plans')?.scrollIntoView({behavior: 'smooth'})}} className="px-8 py-4 text-lg">View Plans</Button>
                            </div>
                        </div>
                    </section>
                )}

                 {/* Features Section */}
                {(showFeatures || editMode) && (
                    <section className={`py-20 bg-gray-50 dark:bg-gray-800/50 ${!showFeatures && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showFeatures && <div className="absolute top-0 right-0 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 mx-auto text-blue-600 dark:text-blue-400"><SecureIcon/></div>
                                    <EditableText editMode={editMode} value={pageContent.feature1Title || ''} onChange={handleContentChange('feature1Title')} tag="h4" className="text-xl font-bold mb-3" />
                                    <EditableText editMode={editMode} value={pageContent.feature1Desc || ''} onChange={handleContentChange('feature1Desc')} multiline className="text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 mx-auto text-purple-600 dark:text-purple-400"><NetworkIcon/></div>
                                    <EditableText editMode={editMode} value={pageContent.feature2Title || ''} onChange={handleContentChange('feature2Title')} tag="h4" className="text-xl font-bold mb-3" />
                                    <EditableText editMode={editMode} value={pageContent.feature2Desc || ''} onChange={handleContentChange('feature2Desc')} multiline className="text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6 mx-auto text-green-600 dark:text-green-400"><GrowthIcon/></div>
                                    <EditableText editMode={editMode} value={pageContent.feature3Title || ''} onChange={handleContentChange('feature3Title')} tag="h4" className="text-xl font-bold mb-3" />
                                    <EditableText editMode={editMode} value={pageContent.feature3Desc || ''} onChange={handleContentChange('feature3Desc')} multiline className="text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                            </div>
                        </div>
                    </section>
                )}
                
                {/* Global Reach (Currencies) Section */}
                {(showMultiCurrency || editMode) && (
                    <section className={`py-24 bg-gray-900 text-white relative overflow-hidden ${!showMultiCurrency && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showMultiCurrency && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/20 to-transparent pointer-events-none"></div>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <div className="text-center mb-16 max-w-3xl mx-auto">
                                <EditableText editMode={editMode} value={pageContent.multiCurrencyTitle || ''} onChange={handleContentChange('multiCurrencyTitle')} tag="h2" className="text-3xl md:text-4xl font-extrabold mb-4" />
                                <EditableText editMode={editMode} value={pageContent.multiCurrencyDesc || ''} onChange={handleContentChange('multiCurrencyDesc')} tag="p" multiline className="text-lg text-gray-400" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-8 rounded-2xl hover:border-green-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-400">
                                        <UsdIcon />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">US Dollar (USD)</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Access a wide range of investment plans priced in USD. All your earnings from our global network are automatically converted and can be withdrawn directly to your preferred US Dollar payment methods.
                                    </p>
                                </div>
                                
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-8 rounded-2xl hover:border-indigo-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mb-6 text-indigo-400">
                                        <EurIcon />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">Euro (EUR)</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        For our European members, all plans and transactions are available in Euros. Refer members from any country and receive your commissions seamlessly in EUR, ready for withdrawal.
                                    </p>
                                </div>
                                
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-8 rounded-2xl hover:border-teal-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-teal-900/30 rounded-full flex items-center justify-center mb-6 text-teal-400">
                                        <PkrIcon />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">Pakistani Rupee (PKR)</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        We offer dedicated plans and local payment methods for our members in Pakistan. Invest and withdraw in PKR, while still earning from referrals using any currency on the platform.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Investment Plans Section */}
                {(showInvestmentPlans || editMode) && featuredPlans.length > 0 && (
                    <section id="plans" className={`py-20 bg-white dark:bg-gray-900 ${!showInvestmentPlans && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showInvestmentPlans && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <h3 className="text-3xl md:text-4xl font-bold text-center mb-4">Investment Plans</h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12">Choose the plan that suits your financial goals. Transparent pricing with high returns.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {featuredPlans.map(plan => (
                                    <div key={plan._id} className="relative group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <h4 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h4>
                                        <div className="flex items-baseline mb-4">
                                            <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(plan.price, plan.currency)}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 min-h-[40px]">{plan.description}</p>
                                        
                                        <ul className="space-y-4 mb-8">
                                            <li className="flex items-center text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-3"><CheckIcon /></div> Duration: {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</li>
                                            <li className="flex items-center text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-3"><CheckIcon /></div> Min. Withdraw: {formatCurrency(plan.minWithdraw, plan.currency)}</li>
                                            <li className="flex items-center text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-3"><CheckIcon /></div> Direct Commission: {renderDirectCommission(plan)}</li>
                                        </ul>
                                        <Button className="w-full py-3 text-lg font-semibold bg-gray-900 dark:bg-gray-700 hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors" onClick={() => navigate('/register')}>Choose {plan.name}</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* MLM System Section */}
                {(showMLM || editMode) && (
                    <section className={`py-20 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 ${!showMLM && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showMLM && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="text-center mb-12">
                                 <EditableText editMode={editMode} value={pageContent.mlmTitle || ''} onChange={handleContentChange('mlmTitle')} tag="h2" className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4" />
                                 <EditableText editMode={editMode} value={pageContent.mlmDesc || ''} onChange={handleContentChange('mlmDesc')} tag="p" multiline className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                            </div>

                            <div className="flex flex-col lg:flex-row items-center gap-12">
                                {/* Text Content */}
                                <div className="lg:w-1/2 space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">How It Works</h3>
                                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                        Think of it like building a team. Your network has multiple levels, and you earn commissions from each:
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Level 1 (Direct Referrals)</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">You earn a commission when you personally invite someone to join.</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Level 2 (Indirect Referrals)</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">When your Level 1 referral invites a new member, you also earn a commission.</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-700/50 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Deeper Levels (3, 4, etc.)</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">The process continues. You earn a commission when your Level 2 referrals bring in new members (your Level 3), and so on.</p>
                                        </div>
                                    </div>

                                    <p className="text-gray-600 dark:text-gray-300 italic text-sm border-l-4 border-blue-500 pl-4 py-1">
                                        This creates a powerful ripple effect, rewarding you for your leadership as your network grows. The bigger and more active your team, the higher your earning potential.
                                    </p>

                                    <ul className="space-y-2 mt-4">
                                        <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 mr-2">✓</span> <strong>Direct Commission (Level 1):</strong> &nbsp; Earned from the people you personally refer.
                                        </li>
                                        <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 mr-2">✓</span> <strong>Indirect Commission (Level 2+):</strong> &nbsp; Earned from referrals made by your team.
                                        </li>
                                        <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 mr-2">✓</span> <strong>Unlimited Growth:</strong> &nbsp; The bigger and more active your network, the higher your potential.
                                        </li>
                                    </ul>
                                </div>

                                {/* Diagram */}
                                <div className="lg:w-1/2 w-full">
                                    <div className="bg-white dark:bg-gray-900 p-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                                        <MLMDiagram />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* NEW: Payment Methods Section (Dynamic & Admin Controlled) */}
                {(showPaymentMethods || editMode) && (
                    <section className={`py-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 overflow-hidden ${!showPaymentMethods && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showPaymentMethods && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="text-center mb-12">
                                <EditableText editMode={editMode} value={pageContent.paymentMethodsTitle || ''} onChange={handleContentChange('paymentMethodsTitle')} tag="h2" className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4" />
                                <EditableText editMode={editMode} value={pageContent.paymentMethodsDesc || ''} onChange={handleContentChange('paymentMethodsDesc')} tag="p" multiline className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                            </div>
                            
                            {editMode && (
                                <div className="max-w-4xl mx-auto mb-10 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                                    <div className="flex gap-4 items-center">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Animation</label>
                                            <select 
                                                value={(pageContent as any).paymentMethodsDisplayType || 'static'} 
                                                onChange={handleSelectChange('paymentMethodsDisplayType')} 
                                                className="text-sm rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-1"
                                            >
                                                <option value="static">Still (Static Grid)</option>
                                                <option value="sliding">Slide (Marquee)</option>
                                                <option value="pulsing">Blink (Pulse)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Style</label>
                                            <select 
                                                value={(pageContent as any).paymentMethodsColorStyle || 'color'} 
                                                onChange={handleSelectChange('paymentMethodsColorStyle')} 
                                                className="text-sm rounded border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-1"
                                            >
                                                <option value="color">Original Color</option>
                                                <option value="grayscale">Grayscale (Color on Hover)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => navigate('/admin/settings')}>Manage Payment Methods</Button>
                                </div>
                            )}

                            <div className={`relative ${pmDisplayType === 'sliding' ? 'w-full' : ''}`}>
                                {pmDisplayType === 'sliding' ? (
                                    // Sliding Animation Wrapper
                                    <div className="flex animate-slide gap-8 items-center">
                                        {/* Duplicated list for seamless loop */}
                                        {slidingMethods.map((pm, idx) => (
                                            <PaymentMethodCard key={`${pm.name}-${idx}`} pm={pm} colorStyle={pmColorStyle} />
                                        ))}
                                    </div>
                                ) : (
                                    // Static or Pulsing Grid
                                    <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10 opacity-90 hover:opacity-100 transition-opacity">
                                        {activePaymentMethods.map((pm, idx) => (
                                            <div key={idx} className={pmDisplayType === 'pulsing' ? 'animate-pulse' : ''}>
                                                <PaymentMethodCard pm={pm} colorStyle={pmColorStyle} />
                                            </div>
                                        ))}
                                        {activePaymentMethods.length === 0 && (
                                            <div className="text-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg w-full max-w-lg mx-auto">
                                                <p className="text-gray-500 dark:text-gray-400 mb-2">No payment logos configured.</p>
                                                {currentUser?.username === 'admin' && (
                                                    <Button size="sm" onClick={() => navigate('/admin/settings')}>Add Payment Logos</Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Video Showcase Section */}
                {(showVideoSection && (settings.homepageVideoUrl || editMode)) && (
                    <section className={`py-20 bg-gray-900 text-white ${!showVideoSection && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            {editMode && !showVideoSection && (
                                <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>
                            )}
                            <div className="text-center mb-12">
                                <EditableText editMode={editMode} value={pageContent.videoTitle || ''} onChange={handleContentChange('videoTitle')} tag="h2" className="text-3xl md:text-4xl font-bold" />
                                <EditableText editMode={editMode} value={pageContent.videoDesc || ''} onChange={handleContentChange('videoDesc')} multiline className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto" />
                            </div>
                            
                            {editMode && (
                                <div className="max-w-2xl mx-auto mb-8 bg-gray-800 p-4 rounded-lg border border-gray-700">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Video Embed URL</label>
                                    <input 
                                        type="text" 
                                        value={videoUrl} 
                                        onChange={handleVideoUrlChange} 
                                        className="w-full rounded-md bg-gray-700 border-gray-600 text-white p-3 focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://www.youtube.com/embed/..."
                                    />
                                </div>
                            )}

                            {videoUrl && (
                                <div className="aspect-w-16 aspect-h-9 max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-black">
                                    <iframe
                                        className="w-full h-full"
                                        src={videoUrl}
                                        title="Platform Showcase Video"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen>
                                    </iframe>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* FAQ Section */}
                {(showFAQ || editMode) && (
                    <section className={`py-20 bg-white dark:bg-gray-800 ${!showFAQ && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showFAQ && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
                                <p className="text-lg text-gray-600 dark:text-gray-400">Everything you need to know about getting started.</p>
                            </div>

                            <div className="space-y-4">
                                {localFaqs.length > 0 ? (
                                    localFaqs.map((faq, index) => (
                                        <div key={index} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
                                            <div className="p-6">
                                                {editMode ? (
                                                    <div className="space-y-3">
                                                        <input 
                                                            type="text" 
                                                            className="w-full font-bold text-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2" 
                                                            value={faq.question} 
                                                            onChange={(e) => handleFaqChange(index, 'question', e.target.value)} 
                                                            placeholder="Question"
                                                        />
                                                        <textarea 
                                                            className="w-full text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 h-24" 
                                                            value={faq.answer} 
                                                            onChange={(e) => handleFaqChange(index, 'answer', e.target.value)} 
                                                            placeholder="Answer"
                                                        />
                                                        <div className="text-right">
                                                            <Button size="sm" variant="danger" onClick={() => handleDeleteFaq(index)}><TrashIcon/> Delete FAQ</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <details className="group">
                                                        <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-lg text-gray-900 dark:text-white">
                                                            <span>{faq.question}</span>
                                                            <span className="transition group-open:rotate-180">
                                                                <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                                                            </span>
                                                        </summary>
                                                        <p className="text-gray-600 dark:text-gray-300 mt-3 group-open:animate-fadeIn">
                                                            {faq.answer}
                                                        </p>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-500 py-8">No FAQs available yet.</div>
                                )}
                                
                                {editMode && (
                                    <div className="text-center pt-6">
                                        <Button onClick={handleAddFaq}><PlusIcon/> Add New Question</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Final CTA */}
                {(showCTA || editMode) && (
                    <section className={`py-24 bg-blue-600 dark:bg-blue-900 text-white relative overflow-hidden ${!showCTA && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showCTA && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500 opacity-20 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-500 opacity-20 blur-3xl"></div>
                        
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                            <EditableText editMode={editMode} value={pageContent.ctaTitle || ''} onChange={handleContentChange('ctaTitle')} tag="h2" className="text-4xl md:text-5xl font-bold mb-6" />
                            <EditableText editMode={editMode} value={pageContent.ctaDesc || ''} onChange={handleContentChange('ctaDesc')} multiline className="text-xl text-blue-100 max-w-2xl mx-auto mb-10" />
                            <div>
                                <Button 
                                    size="lg" 
                                    onClick={() => navigate('/register')} 
                                    style={{ backgroundColor: '#ffffff', color: '#2563eb' }}
                                    className="border-0 px-10 py-4 text-lg font-bold shadow-xl transition-transform hover:scale-105 hover:bg-gray-100"
                                >
                                    Create Your Account
                                </Button>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-gray-900 border-t dark:border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="mb-4 md:mb-0">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">SmartEarning</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Empowering financial growth globally.</p>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            &copy; {new Date().getFullYear()} SmartEarning. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;