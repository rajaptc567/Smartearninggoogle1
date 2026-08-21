
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { InvestmentPlan, formatCurrency, HomepageContent, FaqItem } from '../types';
import { updateSettings } from '../services/api';
import { LoadingCircle } from '../components/ui/LoadingCircle';
import { SmartexnLandingPage } from '../components/SmartexnLandingPage';
import { SEOHead } from '../components/SEOHead';
import { 
    defaultPrivacyPolicyContent, defaultPrivacyPolicyTitle, defaultPrivacyPolicyUpdated, 
    defaultRefundPolicyContent, defaultRefundPolicyTitle, defaultRefundPolicyUpdated, 
    defaultTermsOfUseContent, defaultTermsOfUseTitle, defaultTermsOfUseUpdated 
} from '../data/legalDefaults';

// --- Loading Component ---
const SectionLoading: React.FC<{ text?: string }> = ({ text = "Fresh data is loading." }) => (
    <LoadingCircle text={text} size="md" />
);


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
const NetworkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const GrowthIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const UsdIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /><path d="M12 12a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></svg>;
const EurIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536A9.004 9.004 0 0112 16.5c-2.43 0-4.63-.92-6.287-2.464m12.574-3.072a9.004 9.004 0 00-12.574 0M14.121 8.464A9.004 9.004 0 0112 7.5c-2.43 0-4.63.92-6.287 2.464" /></svg>;
const PkrIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>; 
const PlusIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const GenericPaymentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const ChevronDownIcon = ({ className = "" }) => <svg className={`w-5 h-5 transition-transform duration-300 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;
const StarIcon = ({ filled = false, className = "" }) => (
    <svg className={`w-5 h-5 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'} ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
    </svg>
);

const VideoIcon = () => (
    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LikeIcon = () => (
    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.757c1.246 0 2.25 1.01 2.25 2.25 0 .53-.186 1.03-.51 1.44l-3 4A2.25 2.25 0 0115.75 19H9.25a2.25 2.25 0 01-2.24-2.03L6.05 10H4a2 2 0 01-2-2V5a2 2 0 012-2h2a2 2 0 012 2v1h5.13a2 2 0 011.87 2.13L14 10z" />
    </svg>
);

const SubscriberIcon = () => (
    <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

const EarnBagIcon = () => (
    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12V11m0 1c-1.11 0-2.08-.402-2.599-1M12 12v1.5m0 3.5v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// Reusable Payment Method Card Component - MAXIMIZED VISIBILITY & FIXED SPACING
const PaymentMethodCard: React.FC<{ pm: { name: string, logoUrl?: string }; colorStyle: string }> = ({ pm, colorStyle }) => (
    <div className="bg-white dark:bg-gray-800 p-0 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col items-center w-28 h-32 md:w-44 md:h-48 transition-all duration-300 transform hover:scale-105 hover:shadow-xl group overflow-hidden">
        {/* Logo container - Takes remaining space */}
        <div className={`w-full flex-grow flex items-center justify-center p-2.5 ${colorStyle === 'grayscale' ? 'grayscale group-hover:grayscale-0' : ''} transition-all duration-300 bg-white dark:bg-gray-900/10`}>
            {pm.logoUrl ? (
                <img src={pm.logoUrl} alt={pm.name} className="max-w-[85%] max-h-[85%] object-contain drop-shadow-sm" title={pm.name} />
            ) : (
                <GenericPaymentIcon />
            )}
        </div>
        
        {/* Title Bar - Fixed Height & High Contrast to prevent text clipping */}
        <div className="w-full min-h-[36px] md:min-h-[48px] bg-blue-600 dark:bg-blue-700 flex items-center justify-center flex-shrink-0 shadow-inner px-1.5 border-t border-blue-500/50">
            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-white text-center leading-tight break-words w-full flex items-center justify-center">
                {pm.name}
            </span>
        </div>
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
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [activePolicyModal, setActivePolicyModal] = useState<'privacy' | 'refund' | 'terms' | null>(null);

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

    useEffect(() => {
        const defaultTitle = "SmartExn | Online Micro-Tasks, Surveys & Global Gigs";
        const defaultDesc = "Complete online micro-tasks, surveys and gigs on SmartExn, submit proof and earn rewards when approved. Businesses can create campaigns and reach a global task-based workforce.";
        const seoTitle = settings.seoTitle || defaultTitle;
        const seoDescription = settings.seoDescription || defaultDesc;
        document.title = seoTitle;

        // Structured SEO Metadata containing high-yield organic search term triggers
        const metaTags: Record<string, string> = {
            description: seoDescription,
            keywords: settings.seoKeywords || "online micro tasks, micro jobs, earn money completing tasks, paid online tasks, online surveys, crowdsourced workforce, micro-task campaigns, hire micro workers, create task campaigns, global task marketplace",
            author: "SmartExn Global",
            robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
            "og:title": seoTitle,
            "og:description": seoDescription,
            "og:type": "website",
            "og:url": "https://smartexn.com/",
            "og:site_name": "SmartExn",
            "twitter:card": "summary_large_image",
            "twitter:title": seoTitle,
            "twitter:description": seoDescription,
        };

        Object.entries(metaTags).forEach(([key, val]) => {
            let element = document.querySelector(`meta[name="${key}"]`) || document.querySelector(`meta[property="${key}"]`);
            if (!element) {
                element = document.createElement('meta');
                if (key.startsWith('og:')) {
                    element.setAttribute('property', key);
                } else {
                    element.setAttribute('name', key);
                }
                document.head.appendChild(element);
            }
            element.setAttribute('content', val);
        });

        // Canonical link resolution to prevent crawler duplication penalties
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', "https://smartexn.com/");

        // JSON-LD Schema.org Multi-Graph generation for search engine rich snippets
        let schemaScript = document.getElementById('seo-schema-jsonld') as HTMLScriptElement;
        if (!schemaScript) {
            schemaScript = document.createElement('script');
            schemaScript.id = 'seo-schema-jsonld';
            schemaScript.type = 'application/ld+json';
            document.head.appendChild(schemaScript);
        }

        const faqsForSchema = localFaqs.filter(f => f.showOnHomepage);
        const faqsSchema = faqsForSchema.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f.answer
            }
        }));

        const schemaData = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Organization",
                    "@id": "https://smartexn.com/#organization",
                    "name": "SmartExn",
                    "url": "https://smartexn.com",
                    "logo": "https://smartexn.com/favicon.svg",
                    "description": "SmartExn is a global crowdsourcing and digital micro-task network connecting task earners with advertisers and businesses.",
                    "contactPoint": {
                        "@type": "ContactPoint",
                        "contactType": "customer support",
                        "email": "support@smartexn.com",
                        "url": "https://smartexn.com/faqs"
                    }
                },
                {
                    "@type": "WebSite",
                    "@id": "https://smartexn.com/#website",
                    "url": "https://smartexn.com",
                    "name": "SmartExn",
                    "description": seoDescription,
                    "publisher": {
                        "@id": "https://smartexn.com/#organization"
                    },
                    "potentialAction": [
                        {
                            "@type": "SearchAction",
                            "target": "https://smartexn.com/faqs?q={search_term_string}",
                            "query-input": "required name=search_term_string"
                        }
                    ]
                },
                ...(faqsSchema.length > 0 ? [{
                    "@type": "FAQPage",
                    "@id": "https://smartexn.com/#faq",
                    "mainEntity": faqsSchema
                }] : [])
            ]
        };

        schemaScript.textContent = JSON.stringify(schemaData);

        return () => {
            const script = document.getElementById('seo-schema-jsonld');
            if (script) script.remove();
        };
    }, [settings.seoTitle, settings.seoDescription, settings.seoKeywords, localFaqs]);

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
    const handleFaqChange = (index: number, field: keyof FaqItem, value: any) => {
        const updatedFaqs = [...localFaqs];
        updatedFaqs[index] = { ...updatedFaqs[index], [field]: value };
        setLocalFaqs(updatedFaqs);
        setIsDirty(true);
    };

    const handleAddFaq = () => {
        setLocalFaqs([...localFaqs, { question: 'New Question', answer: 'New Answer', showOnHomepage: false }]);
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

    const displayedFaqs = useMemo(() => {
        if (editMode) return localFaqs;
        return localFaqs.filter(f => f.showOnHomepage);
    }, [localFaqs, editMode]);

    if ((settings.landingPageStyle || 'smartexn') === 'smartexn' && !editMode) {
        return (
            <div className="min-h-screen relative">
                {currentUser?.username === 'admin' && (
                    <div className="fixed bottom-4 right-4 z-50 bg-slate-900/90 border border-sky-500/50 text-white p-2.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
                        <span className="font-bold text-sky-400">Admin Mode</span>
                        <button 
                            onClick={() => setEditMode(true)} 
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
                        >
                            Edit Page
                        </button>
                        <button 
                            onClick={() => navigate('/settings')} 
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
                        >
                            Layout Settings
                        </button>
                    </div>
                )}
                
                <SmartexnLandingPage onOpenPolicy={(policy) => {
                    if (policy === 'privacy' || policy === 'refund' || policy === 'terms') {
                        setActivePolicyModal(policy);
                    }
                }} />

                {/* Policy Modals */}
                {activePolicyModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all animate-fade-in" onClick={() => setActivePolicyModal(null)}>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative transition-transform transform scale-100" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={() => setActivePolicyModal(null)} 
                                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                            
                            {activePolicyModal === 'privacy' && (
                                <div>
                                    <span className="text-xs font-black tracking-widest text-blue-500 uppercase block mb-2">Security & Data Safeguards</span>
                                    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.privacyPolicyTitle || defaultPrivacyPolicyTitle}</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.privacyPolicyUpdated || defaultPrivacyPolicyUpdated}</p>
                                    <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                        {settings.privacyPolicyContent || defaultPrivacyPolicyContent}
                                    </div>
                                </div>
                            )}
                            
                            {activePolicyModal === 'refund' && (
                                <div>
                                    <span className="text-xs font-black tracking-widest text-red-500 uppercase block mb-2">Important Financial Notice</span>
                                    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.refundPolicyTitle || defaultRefundPolicyTitle}</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.refundPolicyUpdated || defaultRefundPolicyUpdated}</p>
                                    <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                        {settings.refundPolicyContent || defaultRefundPolicyContent}
                                    </div>
                                </div>
                            )}
                            
                            {activePolicyModal === 'terms' && (
                                <div>
                                    <span className="text-xs font-black tracking-widest text-blue-500 uppercase block mb-2">Rules & Guidelines</span>
                                    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.termsOfUseTitle || defaultTermsOfUseTitle}</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.termsOfUseUpdated || defaultTermsOfUseUpdated}</p>
                                    <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                        {settings.termsOfUseContent || defaultTermsOfUseContent}
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                <Button onClick={() => setActivePolicyModal(null)} className="rounded-xl px-6 py-2">
                                    Acknowledge & Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans">
            <SEOHead 
                title="SmartExn | Online Micro-Tasks, Surveys & Global Gigs"
                description="Complete online micro-tasks, surveys and gigs on SmartExn, submit proof and earn rewards when approved. Businesses can create campaigns and reach a global task-based workforce."
                canonicalUrl="https://smartexn.com/"
                robots="index, follow"
            />
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
                    <section className={`relative py-12 md:py-20 text-center overflow-hidden bg-white dark:bg-gray-900 ${!showHero && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showHero && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-gray-900"></div>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <div className="text-[10px] sm:text-xs font-black tracking-[0.2em] text-blue-600 dark:text-blue-400 uppercase mb-3">
                                Secure Network Marketing Platform • Multi-Currency Wallet Investment System
                            </div>
                            <EditableText editMode={editMode} value={pageContent.heroTitle || ''} onChange={handleContentChange('heroTitle')} tag="h1" className="text-3xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4 leading-tight" />
                            <EditableText editMode={editMode} value={pageContent.heroSubtitle || ''} onChange={handleContentChange('heroSubtitle')} tag="p" multiline className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed" />
                            <div className="mt-6 flex justify-center gap-3">
                                <Button size="lg" onClick={() => navigate('/register')} className="shadow-lg shadow-blue-500/20 px-6 py-3 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0">Start Earning</Button>
                                <Button size="lg" variant="secondary" onClick={() => {document.getElementById('plans')?.scrollIntoView({behavior: 'smooth'})}} className="px-6 py-3 text-base">View Plans</Button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Zero-Investment Gigs & Daily Social Tasks Section */}
                <section id="tasks" className="py-12 md:py-16 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-800/10 dark:via-gray-900 dark:to-gray-800/10 border-t border-b border-gray-200/60 dark:border-gray-800/60 relative overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
                            <span className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-emerald-600 dark:text-emerald-400 uppercase mb-2 block">
                                NO INVESTMENT REQUIRED • EARN DAILY
                            </span>
                            <h2 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3 uppercase">
                                Zero-Investment Daily Gigs & Social Tasks
                            </h2>
                            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                                Don't want to purchase an investment plan? No problem! Complete simple daily social media tasks, watch promotional videos, follow premium channels, and get paid instantly in <strong>USD, EUR, or PKR</strong> with local withdrawals.
                            </p>
                        </div>

                        {/* Split Layout: Interactive Task Gigs Preview & How it works */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                            {/* Left: Interactive Live Tasks Preview */}
                            <div className="lg:col-span-7 space-y-4">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-md p-4 md:p-6 relative">
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[9px] font-black uppercase tracking-wider text-green-500">Live Gigs</span>
                                    </div>
                                    
                                    <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <EarnBagIcon />
                                        Task Board Marketplace
                                    </h3>

                                    {/* Task List container */}
                                    <div className="space-y-3">
                                        {/* Task 1 */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-100 dark:bg-red-950/30 rounded-lg">
                                                    <VideoIcon />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[8px] font-bold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 px-1.5 py-0.5 rounded-full uppercase">YouTube</span>
                                                        <span className="text-[8px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded-full">3 Mins Watch</span>
                                                    </div>
                                                    <h4 className="font-bold text-xs md:text-sm text-gray-900 dark:text-white mt-1">Watch SmartEarning Platform Presentation Video</h4>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 sm:mt-0 flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">+$0.15 <span className="text-[9px] text-gray-400 font-normal">/ €0.14 / 42.0 PKR</span></span>
                                                <Button size="sm" onClick={() => navigate('/register')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg px-3 py-1">Start</Button>
                                            </div>
                                        </div>

                                        {/* Task 2 */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-950/30 rounded-lg">
                                                    <LikeIcon />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[8px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 px-1.5 py-0.5 rounded-full uppercase">Facebook</span>
                                                        <span className="text-[8px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded-full">Like & Page Follow</span>
                                                    </div>
                                                    <h4 className="font-bold text-xs md:text-sm text-gray-900 dark:text-white mt-1">Like & Follow official Sponsor Page</h4>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 sm:mt-0 flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">+$0.10 <span className="text-[9px] text-gray-400 font-normal">/ €0.09 / 28.0 PKR</span></span>
                                                <Button size="sm" onClick={() => navigate('/register')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg px-3 py-1">Start</Button>
                                            </div>
                                        </div>

                                        {/* Task 3 */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-950/30 rounded-lg">
                                                    <SubscriberIcon />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[8px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 px-1.5 py-0.5 rounded-full uppercase">Telegram</span>
                                                        <span className="text-[8px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded-full">Subscribe</span>
                                                    </div>
                                                    <h4 className="font-bold text-xs md:text-sm text-gray-900 dark:text-white mt-1">Join CryptoSignals Telegram Announcement Channel</h4>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 sm:mt-0 flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">+$0.12 <span className="text-[9px] text-gray-400 font-normal">/ €0.11 / 33.5 PKR</span></span>
                                                <Button size="sm" onClick={() => navigate('/register')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg px-3 py-1">Start</Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-[11px] text-gray-500">And hundreds of other custom micro-tasks added daily by publishers globally.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Dual-Benefit Model (Worker vs Advertiser) */}
                            <div className="lg:col-span-5 space-y-4 md:space-y-6">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">One Platform, Two Powerhouses</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                        Whether you want to earn simple daily cash in your spare time or promote your social media profiles to gain real, authentic engagement, our dual-purpose gig system fits your exact needs.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Worker */}
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center font-bold text-sm">1</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Earn Daily as a Worker</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                                Complete tasks at your own convenience. Submit proof (text or screenshots) and watch your balance grow instantly. Withdraw your earnings daily with secure PKR/USD/EUR payment channels.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Creator */}
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm">2</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Promote as a Task Creator</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                                Need high-quality social proof, active watch time, comments, or signups? Top up your balance, submit your custom task specifications, and have thousands of active users engage with your brand instantly.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button size="lg" onClick={() => navigate('/register')} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold uppercase tracking-wider text-xs shadow-md shadow-emerald-500/15 py-3">
                                        Open Free Earning Account Now
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                 {/* Features Section */}
                {(showFeatures || editMode) && (
                    <section className={`py-10 md:py-16 bg-gray-50 dark:bg-gray-800/50 ${!showFeatures && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showFeatures && <div className="absolute top-0 right-0 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-center">
                                 <div className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto text-blue-600 dark:text-blue-400"><SecureIcon/></div>
                                    <span className="text-[10px] font-black tracking-widest uppercase text-blue-500 mb-1.5 block">Secure Network Marketing Platform</span>
                                    <EditableText editMode={editMode} value={pageContent.feature1Title || ''} onChange={handleContentChange('feature1Title')} tag="h4" className="text-lg md:text-xl font-bold mb-1.5" />
                                    <EditableText editMode={editMode} value={pageContent.feature1Desc || ''} onChange={handleContentChange('feature1Desc')} multiline className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto text-purple-600 dark:text-purple-400"><NetworkIcon/></div>
                                    <span className="text-[10px] font-black tracking-widest uppercase text-purple-500 mb-1.5 block">Peer-to-Peer Ledger Investment Portal</span>
                                    <EditableText editMode={editMode} value={pageContent.feature2Title || ''} onChange={handleContentChange('feature2Title')} tag="h4" className="text-lg md:text-xl font-bold mb-1.5" />
                                    <EditableText editMode={editMode} value={pageContent.feature2Desc || ''} onChange={handleContentChange('feature2Desc')} multiline className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition-transform duration-300">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4 mx-auto text-green-600 dark:text-green-400"><GrowthIcon/></div>
                                    <span className="text-[10px] font-black tracking-widest uppercase text-green-500 mb-1.5 block">Real-Time MLM Earning Dashboard</span>
                                    <EditableText editMode={editMode} value={pageContent.feature3Title || ''} onChange={handleContentChange('feature3Title')} tag="h4" className="text-lg md:text-xl font-bold mb-1.5" />
                                    <EditableText editMode={editMode} value={pageContent.feature3Desc || ''} onChange={handleContentChange('feature3Desc')} multiline className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" />
                                </div>
                             </div>
                        </div>
                    </section>
                )}
                
                {/* Global Reach (Currencies) Section */}
                {(showMultiCurrency || editMode) && (
                    <section className={`py-12 md:py-16 bg-gray-900 text-white relative overflow-hidden ${!showMultiCurrency && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showMultiCurrency && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/20 to-transparent pointer-events-none"></div>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <div className="text-center mb-8 md:mb-10 max-w-3xl mx-auto">
                                <EditableText editMode={editMode} value={pageContent.multiCurrencyTitle || ''} onChange={handleContentChange('multiCurrencyTitle')} tag="h2" className="text-2xl md:text-4xl font-extrabold mb-3" />
                                <EditableText editMode={editMode} value={pageContent.multiCurrencyDesc || ''} onChange={handleContentChange('multiCurrencyDesc')} tag="p" multiline className="text-sm md:text-base text-gray-400" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-5 md:p-6 rounded-2xl hover:border-green-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-400">
                                        <UsdIcon />
                                    </div>
                                    <h3 className="text-lg font-bold mb-1.5">US Dollar (USD)</h3>
                                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                                        Access a wide range of investment plans priced in USD. All your earnings from our global network are automatically converted and can be withdrawn directly to your preferred US Dollar payment methods.
                                    </p>
                                </div>
                                
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-5 md:p-6 rounded-2xl hover:border-indigo-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-14 h-14 bg-indigo-900/30 rounded-full flex items-center justify-center mb-4 text-indigo-400">
                                        <EurIcon />
                                    </div>
                                    <h3 className="text-lg font-bold mb-1.5">Euro (EUR)</h3>
                                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                                        For our European members, all plans and transactions are available in Euros. Refer members from any country and receive your commissions seamlessly in EUR, ready for withdrawal.
                                    </p>
                                </div>
                                
                                <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-5 md:p-6 rounded-2xl hover:border-teal-500/50 transition-colors duration-300 flex flex-col items-center text-center">
                                    <div className="w-14 h-14 bg-teal-900/30 rounded-full flex items-center justify-center mb-4 text-teal-400">
                                        <PkrIcon />
                                    </div>
                                    <h3 className="text-lg font-bold mb-1.5">Pakistani Rupee (PKR) - Local Channels</h3>
                                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                                        We operate as a premier <strong>local payment investment platform</strong> in Pakistan. With seamless deposits and withdrawals through <strong>our secure local channels</strong>, you can instantly subscribe to high-performing options like our <strong>premium plans</strong> and withdraw your earnings directly to your mobile wallet.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Investment Plans Section */}
                {(showInvestmentPlans || editMode) && featuredPlans.length > 0 && (
                    <section id="plans" className={`py-10 md:py-16 bg-white dark:bg-gray-900 ${!showInvestmentPlans && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showInvestmentPlans && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-center mb-3 text-gray-900 dark:text-white">
                                High-Yield Crypto Investment Plans & Passive Earnings
                            </h2>
                            <p className="text-center text-sm md:text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-6 md:mb-8">
                                Discover highly lucrative financial packages tailored for maximum return. From budget-friendly <strong>plans</strong> in PKR to globally scalable options, we make wealth generation simple and secure.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {featuredPlans.map(plan => (
                                    <div key={plan._id} className="relative group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <h4 className="text-xl md:text-2xl font-bold mb-1 text-gray-900 dark:text-white">{plan.name}</h4>
                                        <div className="flex items-baseline mb-2.5">
                                            <span className="text-3xl md:text-4xl font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(plan.price, plan.currency)}</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 min-h-[30px] md:min-h-[40px]">{plan.description}</p>
                                        
                                        <ul className="space-y-2.5 mb-5 md:mb-6">
                                            <li className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-2.5"><CheckIcon /></div> Duration: {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</li>
                                            <li className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-2.5"><CheckIcon /></div> Min. Withdraw: {formatCurrency(plan.minWithdraw, plan.currency)}</li>
                                            <li className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300"><div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mr-2.5"><CheckIcon /></div> Direct Commission: {renderDirectCommission(plan)}</li>
                                        </ul>
                                        <Button className="w-full py-2.5 text-base font-semibold bg-gray-900 dark:bg-gray-700 hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors" onClick={() => navigate('/register')}>Choose {plan.name}</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}



                {/* MLM System Section */}
                {(showMLM || editMode) && (
                    <section className={`py-10 md:py-16 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 ${!showMLM && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showMLM && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="text-center mb-6 md:mb-8">
                                 <EditableText editMode={editMode} value={pageContent.mlmTitle || ''} onChange={handleContentChange('mlmTitle')} tag="h2" className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3" />
                                 <EditableText editMode={editMode} value={pageContent.mlmDesc || ''} onChange={handleContentChange('mlmDesc')} tag="p" multiline className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                            </div>

                            <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8">
                                {/* Text Content */}
                                <div className="lg:w-1/2 space-y-4">
                                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">
                                        Multi-Tier Referral Commission System
                                    </h3>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                        Our platform acts as a powerful <strong>transparent referral income generator</strong>. Build your network, unlock tiers, and earn through our structural levels managed by automated MLM affiliate software:
                                    </p>
                                    
                                    <div className="space-y-2.5">
                                        <div className="bg-white dark:bg-gray-700/50 p-3 md:p-3.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5">Level 1 - Direct Earnings</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-300">Directly refer partners to earn immediate commissions. Your portfolio works as a transparent referral income generator.</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-700/50 p-3 md:p-3.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5">Level 2 - Passive Network Expansion</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-300">When your direct members refer others, you earn secondary rewards within our passive earning network ecosystem.</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-700/50 p-3 md:p-3.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5">Level 3+ - Fully Automated MLM Affiliate Software</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-300">Commission flows effortlessly down multiple levels of depth, completely managed by our robust automated MLM affiliate software.</p>
                                        </div>
                                    </div>

                                    <p className="text-gray-600 dark:text-gray-300 italic text-xs border-l-4 border-blue-500 pl-4 py-0.5">
                                        This creates a powerful ripple effect, rewarding you for your leadership as your network grows. The bigger and more active your team, the higher your earning potential.
                                    </p>

                                    <ul className="space-y-1.5 mt-2">
                                        <li className="flex items-start text-xs text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 mr-2">✓</span> <strong>Direct Commission (Level 1):</strong> &nbsp; Earned from the people you personally refer.
                                        </li>
                                        <li className="flex items-start text-xs text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 mr-2">✓</span> <strong>Indirect Commission (Level 2+):</strong> &nbsp; Earned from referrals made by your team.
                                        </li>
                                        <li className="flex items-start text-xs text-gray-700 dark:text-gray-300">
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

                {/* REDESIGNED: Payment Methods Section (Optimized for space & fixed clipping) */}
                {(showPaymentMethods || editMode) && (
                    <section className={`py-10 md:py-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 overflow-hidden ${!showPaymentMethods && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showPaymentMethods && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="text-center mb-6 md:mb-8">
                                <EditableText editMode={editMode} value={pageContent.paymentMethodsTitle || ''} onChange={handleContentChange('paymentMethodsTitle')} tag="h2" className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3" />
                                <EditableText editMode={editMode} value={pageContent.paymentMethodsDesc || ''} onChange={handleContentChange('paymentMethodsDesc')} tag="p" multiline className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
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

                            {state.isLoading ? (
                                <SectionLoading text="Fresh data is loading." />
                            ) : (
                                <div className={`relative ${pmDisplayType === 'sliding' ? 'w-full' : ''}`}>
                                    {pmDisplayType === 'sliding' ? (
                                        <div className="flex animate-slide gap-8 items-center">
                                            {slidingMethods.map((pm, idx) => (
                                                <PaymentMethodCard key={`${pm.name}-${idx}`} pm={pm} colorStyle={pmColorStyle} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
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
                            )}
                        </div>
                    </section>
                )}

                {/* Video Showcase Section */}
                {(showVideoSection && (videoUrl || editMode)) && (
                    <section className={`py-10 md:py-16 bg-gray-900 text-white relative ${!showVideoSection && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            {editMode && !showVideoSection && (
                                <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>
                            )}
                            <div className="text-center mb-6 md:mb-8">
                                <EditableText editMode={editMode} value={pageContent.videoTitle || ''} onChange={handleContentChange('videoTitle')} tag="h2" className="text-2xl md:text-4xl font-bold" />
                                <EditableText editMode={editMode} value={pageContent.videoDesc || ''} onChange={handleContentChange('videoDesc')} multiline className="mt-2 text-sm md:text-base text-gray-400 max-w-3xl mx-auto" />
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
                                    <p className="text-xs text-gray-500 mt-2 italic">Note: Video showcase is only visible to guests when a URL is provided and enabled.</p>
                                </div>
                            )}

                            {state.isLoading ? (
                                <SectionLoading text="Fresh data is loading." />
                            ) : videoUrl ? (
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
                            ) : editMode ? (
                                <div className="text-center p-12 border-2 border-dashed border-gray-700 rounded-2xl">
                                    <p className="text-gray-500">No video URL provided. Showcase will be hidden from guests.</p>
                                </div>
                            ) : null}
                        </div>
                    </section>
                )}

                {/* FAQ Section - SMART DISPLAY (Accordion Style) */}
                {(showFAQ || editMode) && (
                    <section className={`py-10 md:py-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 ${!showFAQ && editMode ? 'opacity-50 border-2 border-red-500' : ''}`}>
                        {editMode && !showFAQ && <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded z-50">HIDDEN SECTION</div>}
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
                            <div className="text-center mb-6 md:mb-8">
                                <h2 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 md:mb-3 uppercase">Featured Support Queries</h2>
                                <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">Get instant answers to the most common questions about commissions, levels, and withdrawals.</p>
                            </div>

                            {state.isLoading ? (
                                <SectionLoading text="Fresh data is loading." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                    {displayedFaqs.map((faq, index) => (
                                        <div key={index} className={`bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:border-blue-500/30 group ${!editMode && openFaqIndex === index ? 'ring-2 ring-blue-500/10 border-blue-500/40 bg-white dark:bg-gray-800' : ''}`}>
                                            {editMode ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Question #{index + 1}</span>
                                                            <button 
                                                                onClick={() => handleFaqChange(index, 'showOnHomepage', !faq.showOnHomepage)}
                                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase transition-all ${faq.showOnHomepage ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200' : 'bg-gray-100 text-gray-400'}`}
                                                                title={faq.showOnHomepage ? "Featured on Home" : "Set as Featured"}
                                                            >
                                                                <StarIcon filled={faq.showOnHomepage} className="w-3.5 h-3.5" />
                                                                {faq.showOnHomepage ? 'Featured' : 'Mark Featured'}
                                                            </button>
                                                        </div>
                                                        <button onClick={() => handleDeleteFaq(index)} className="text-red-500 hover:text-red-700 transition-colors"><TrashIcon /></button>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        className="w-full font-bold text-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" 
                                                        value={faq.question} 
                                                        onChange={(e) => handleFaqChange(index, 'question', e.target.value)} 
                                                        placeholder="Enter Question..."
                                                    />
                                                    <textarea 
                                                        className="w-full text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none" 
                                                        value={faq.answer} 
                                                        onChange={(e) => handleFaqChange(index, 'answer', e.target.value)} 
                                                        placeholder="Enter Detailed Answer..."
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col h-full">
                                                    <button 
                                                        onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                                                        className="flex justify-between items-start w-full text-left focus:outline-none"
                                                    >
                                                        <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white flex items-start gap-3 pr-4">
                                                            <span className="text-blue-500 font-black shrink-0">Q.</span>
                                                            {faq.question}
                                                        </h3>
                                                        <div className={`mt-1.5 p-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 transition-colors ${openFaqIndex === index ? 'bg-blue-600 text-white' : ''}`}>
                                                            <ChevronDownIcon className={openFaqIndex === index ? 'rotate-180' : ''} />
                                                        </div>
                                                    </button>
                                                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaqIndex === index ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                                                                {faq.answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                             )}
                            
                            {!editMode && localFaqs.length > displayedFaqs.length && (
                                <div className="text-center mt-8 md:mt-10 animate-bounce">
                                    <Link to="/faqs" className="inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95">
                                        View Full Knowledge Base
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                    </Link>
                                </div>
                            )}

                            {editMode && (
                                <div className="text-center mt-12 pt-8 border-t dark:border-gray-700">
                                    <Button onClick={handleAddFaq} className="rounded-2xl px-10 py-4 font-black uppercase tracking-widest flex items-center gap-2 mx-auto">
                                        <PlusIcon/> Add New Question
                                    </Button>
                                </div>
                            )}
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

            {/* Professional Footer */}
            <footer className="bg-gray-100 dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-800 text-left">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                        {/* Column 1: Brand Profile */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.013A11.959 11.959 0 0112 2.714z" />
                                    </svg>
                                </div>
                                <span className="text-xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">SmartEarning</span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-light leading-relaxed max-w-sm">
                                SmartEarning is an innovative crowdsourced advertising and social multi-level marketing platform. We connect sponsors with verified global network builders to yield mutual digital promotional growth.
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 font-mono">Status: Secure Ledger (MFA enabled)</span>
                            </div>
                        </div>

                        {/* Column 2: Legal Agreements */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-4">Core Agreements</h4>
                            <ul className="space-y-2.5 text-xs font-medium">
                                <li>
                                    <Link to="/privacy-policy?tab=privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
                                </li>
                                <li>
                                    <Link to="/terms-of-use?tab=terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</Link>
                                </li>
                                <li>
                                    <Link to="/privacy-policy?tab=cookie" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Cookie Policy</Link>
                                </li>
                                <li>
                                    <Link to="/privacy-policy?tab=antifraud" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Anti-Fraud Policy</Link>
                                </li>
                            </ul>
                        </div>

                        {/* Column 3: Payouts & Disclaimers */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-4">Financial Policy</h4>
                            <ul className="space-y-2.5 text-xs font-medium">
                                <li>
                                    <Link to="/privacy-policy?tab=withdrawal" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Withdrawal Policy</Link>
                                </li>
                                <li>
                                    <Link to="/refund-policy?tab=refund" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Refund Policy</Link>
                                </li>
                                <li>
                                    <Link to="/privacy-policy?tab=disclaimer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Income Disclaimer</Link>
                                </li>
                            </ul>
                        </div>

                        {/* Column 4: Contact & Corp Info */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider mb-4">Corporate Info</h4>
                            <ul className="space-y-2.5 text-xs font-medium">
                                <li>
                                    <Link to="/privacy-policy?tab=about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</Link>
                                </li>
                                <li>
                                    <Link to="/privacy-policy?tab=contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact Support</Link>
                                </li>
                                <li>
                                    <Link to="/privacy-policy?tab=dmca" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">DMCA Takedowns</Link>
                                </li>
                                <li>
                                    <Link to="/faqs" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQs Knowledgebase</Link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-800/80 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
                        <p>&copy; {new Date().getFullYear()} SmartEarning (smartexn.com). All rights reserved.</p>
                        <div className="flex gap-4">
                            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-600">Built with 128-bit AES Encryption Protocols</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Policy Modals */}
            {activePolicyModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all animate-fade-in" onClick={() => setActivePolicyModal(null)}>
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative transition-transform transform scale-100" onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button 
                            onClick={() => setActivePolicyModal(null)} 
                            className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        
                        {/* Modal Content */}
                        {activePolicyModal === 'privacy' && (
                            <div>
                                <span className="text-xs font-black tracking-widest text-blue-500 uppercase block mb-2">Security & Data Safeguards</span>
                                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.privacyPolicyTitle || defaultPrivacyPolicyTitle}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.privacyPolicyUpdated || defaultPrivacyPolicyUpdated}</p>
                                <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                    {settings.privacyPolicyContent || defaultPrivacyPolicyContent}
                                </div>
                            </div>
                        )}
                        
                        {activePolicyModal === 'refund' && (
                            <div>
                                <span className="text-xs font-black tracking-widest text-red-500 uppercase block mb-2">Important Financial Notice</span>
                                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.refundPolicyTitle || defaultRefundPolicyTitle}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.refundPolicyUpdated || defaultRefundPolicyUpdated}</p>
                                <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                    {settings.refundPolicyContent || defaultRefundPolicyContent}
                                </div>
                            </div>
                        )}
                        
                        {activePolicyModal === 'terms' && (
                            <div>
                                <span className="text-xs font-black tracking-widest text-blue-500 uppercase block mb-2">Rules & Guidelines</span>
                                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{settings.termsOfUseTitle || defaultTermsOfUseTitle}</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">{settings.termsOfUseUpdated || defaultTermsOfUseUpdated}</p>
                                <div className="text-gray-600 dark:text-gray-300 space-y-4 whitespace-pre-line text-sm md:text-base leading-relaxed">
                                    {settings.termsOfUseContent || defaultTermsOfUseContent}
                                </div>
                            </div>
                        )}
                        
                        {/* Close Button at bottom */}
                        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <Button onClick={() => setActivePolicyModal(null)} className="rounded-xl px-6 py-2">
                                Acknowledge & Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
