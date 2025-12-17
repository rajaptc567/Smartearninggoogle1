
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { InvestmentPlan, formatCurrency, HomepageContent, FaqItem } from '../types';
import { updateSettings } from '../services/api';

// --- Reusable Editable Text Component ---
interface EditableTextProps {
  editMode: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  tag?: React.ElementType;
  className?: string;
  multiline?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({ editMode, value, onChange, tag = 'p', className = '', multiline = false }) => {
    const Tag = tag;
    const commonClasses = "transition-all duration-200";
    const editClasses = "bg-white/10 border border-dashed border-blue-400 rounded-md p-1 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white";

    if (editMode) {
        return multiline ? (
            <textarea
                value={value}
                onChange={onChange}
                className={`${commonClasses} ${editClasses} resize-y min-h-[60px] w-full ${className}`}
            />
        ) : (
            <input
                type="text"
                value={value}
                onChange={onChange}
                className={`${commonClasses} ${editClasses} w-full ${className}`}
            />
        );
    }
    return <Tag className={`${commonClasses} ${className}`}>{value}</Tag>;
};

// --- Floating Edit Bar ---
interface EditBarProps {
    onSave: () => void;
    onExit: () => void;
    isSaving: boolean;
    isDirty: boolean;
}
const EditBar: React.FC<EditBarProps> = ({ onSave, onExit, isSaving, isDirty }) => (
    <div className="fixed bottom-5 right-5 z-[100] bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg shadow-2xl flex gap-3 border border-gray-700">
        <Button onClick={onSave} disabled={isSaving || !isDirty} size="sm">
            {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="secondary" onClick={onExit} size="sm">Exit Edit Mode</Button>
    </div>
);


// --- SVG Icon Components for this page ---
const CheckIcon = () => <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;
const SecureIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 019-2.606a11.955 11.955 0 019 2.606c-.311-5.863-3.69-10.964-8.618-13.04z" /></svg>;
const NetworkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const GrowthIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const UsdIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /><path d="M12 12a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></svg>;
const EurIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536A9.004 9.004 0 0112 16.5c-2.43 0-4.63-.92-6.287-2.464m12.574-3.072a9.004 9.004 0 00-12.574 0M14.121 8.464A9.004 9.004 0 0112 7.5c-2.43 0-4.63.92-6.287 2.464" /></svg>;
const PkrIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>; 
const PlusIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const GenericPaymentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;

// Reusable Payment Method Card Component
const PaymentMethodCard: React.FC<{ pm: { name: string, logoUrl?: string }; colorStyle: string }> = ({ pm, colorStyle }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center w-40 h-32 md:w-48 md:h-36 transition-all duration-300 transform hover:scale-105 hover:shadow-md group">
        {pm.logoUrl ? (
            <div className={`w-full h-16 flex items-center justify-center mb-3 ${colorStyle === 'grayscale' ? 'grayscale group-hover:grayscale-0' : ''} transition-all duration-300`}>
                <img src={pm.logoUrl} alt={pm.name} className="max-w-full max-h-full object-contain" title={pm.name} />
            </div>
        ) : (
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3 text-gray-400">
                <GenericPaymentIcon />
            </div>
        )}
        <span className="text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">{pm.name}</span>
    </div>
);

// --- MLM Diagram Component ---
const MLMDiagram = () => ( 
    <div className="flex justify-center items-center p-2 rounded-lg">
        <svg viewBox="0 0 500 320" className="w-full h-auto max-w-2xl drop-shadow-xl">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" /></marker>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor: '#3b82f6', stopOpacity:1}} /><stop offset="100%" style={{stopColor: '#2563eb', stopOpacity:1}} /></linearGradient>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor: '#10b981', stopOpacity:1}} /><stop offset="100%" style={{stopColor: '#059669', stopOpacity:1}} /></linearGradient>
                <linearGradient id="grad3" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor: '#8b5cf6', stopOpacity:1}} /><stop offset="100%" style={{stopColor: '#7c3aed', stopOpacity:1}} /></linearGradient>
                <linearGradient id="grad4" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor: '#ef4444', stopOpacity:1}} /><stop offset="100%" style={{stopColor: '#dc2626', stopOpacity:1}} /></linearGradient>
                <linearGradient id="grad5" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor: '#f59e0b', stopOpacity:1}} /><stop offset="100%" style={{stopColor: '#d97706', stopOpacity:1}} /></linearGradient>
            </defs>
            
            {/* Connecting Lines */}
            <path d="M250 55 L150 95" stroke="#94a3b8" strokeWidth="2" />
            <path d="M250 55 L350 95" stroke="#94a3b8" strokeWidth="2" />
            
            <path d="M150 117 L100 155" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M150 117 L200 155" stroke="#cbd5e1" strokeWidth="1.5" />
            
            <path d="M100 177 L50 215" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M100 177 L150 215" stroke="#e2e8f0" strokeWidth="1" />
            
            <path d="M50 237 L25 275" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M50 237 L75 275" stroke="#e2e8f0" strokeWidth="1" />

            <path d="M350 117 L300 155" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M350 117 L400 155" stroke="#cbd5e1" strokeWidth="1.5" />

            <path d="M400 177 L350 215" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M400 177 L450 215" stroke="#e2e8f0" strokeWidth="1" />
            
            <path d="M450 237 L425 275" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M450 237 L475 275" stroke="#e2e8f0" strokeWidth="1" />

            {/* Commission Flow Indicators */}
            <g>
                <path d="M25 260 Q 50 150 220 50" stroke="#16a34a" strokeWidth="2" fill="none" strokeDasharray="5,5" markerEnd="url(#arrowhead)" opacity="0.6"/>
                <text x="100" y="160" fill="#10b981" fontSize="16" fontWeight="bold">$</text>
                <text x="180" y="100" fill="#10b981" fontSize="16" fontWeight="bold">$</text>
            </g>

            {/* Nodes */}
            <g>
                <circle cx="250" cy="30" r="30" fill="url(#grad1)" stroke="white" strokeWidth="2"/>
                <text x="250" y="35" fontFamily="sans-serif" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">You</text>
            </g>

            <g>
                <circle cx="150" cy="95" r="25" fill="url(#grad2)" stroke="white" strokeWidth="2"/>
                <text x="150" y="93" fontFamily="sans-serif" fontSize="9" fontWeight="bold" fill="white" textAnchor="middle">Direct Ref</text>
                <text x="150" y="103" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User A)</text>
            </g>
             <g>
                <circle cx="350" cy="95" r="25" fill="url(#grad2)" stroke="white" strokeWidth="2"/>
                <text x="350" y="93" fontFamily="sans-serif" fontSize="9" fontWeight="bold" fill="white" textAnchor="middle">Direct Ref</text>
                <text x="350" y="103" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User E)</text>
            </g>

            <g><circle cx="100" cy="155" r="22" fill="url(#grad3)" /><text x="100" y="152" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">Level 2</text><text x="100" y="162" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User B)</text></g>
            <g><circle cx="200" cy="155" r="16" fill="url(#grad3)" /><text x="200" y="158" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Lvl 2</text></g>
            
            <g><circle cx="50" cy="215" r="20" fill="url(#grad4)" /><text x="50" y="212" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 3</text><text x="50" y="222" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User C)</text></g>
            <g><circle cx="150" cy="215" r="14" fill="url(#grad4)" /><text x="150" y="218" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 3</text></g>
            
            <g><circle cx="25" cy="275" r="18" fill="url(#grad5)" /><text x="25" y="272" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 4</text><text x="25" y="282" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User D)</text></g>
            <g><circle cx="75" cy="275" r="12" fill="url(#grad5)" /><text x="75" y="278" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 4</text></g>

            <g><circle cx="400" cy="155" r="22" fill="url(#grad3)" /><text x="400" y="152" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">Level 2</text><text x="400" y="162" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User F)</text></g>
            <g><circle cx="300" cy="155" r="16" fill="url(#grad3)" /><text x="300" y="158" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Lvl 2</text></g>

            <g><circle cx="450" cy="215" r="20" fill="url(#grad4)" /><text x="450" y="212" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 3</text><text x="450" y="222" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User G)</text></g>
            <g><circle cx="350" cy="215" r="14" fill="url(#grad4)" /><text x="350" y="218" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 3</text></g>
            
            <g><circle cx="475" cy="275" r="18" fill="url(#grad5)" /><text x="475" y="272" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 4</text><text x="475" y="282" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User H)</text></g>
            <g><circle cx="425" cy="275" r="12" fill="url(#grad5)" /><text x="425" y="278" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 4</text></g>
        </svg>
    </div>
);


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
