

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useData } from '../hooks/useData';
import { InvestmentPlan, formatCurrency, HomepageContent } from '../types';
import { updateSettings } from '../services/api';

// --- Reusable Editable Text Component ---
interface EditableTextProps {
  editMode: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  // FIX: Changed from `keyof JSX.IntrinsicElements` to `React.ElementType` to resolve missing namespace 'JSX' error.
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
const UsdIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /><path d="M12 12a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></svg>;
const EurIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536A9.004 9.004 0 0112 16.5c-2.43 0-4.63-.92-6.287-2.464m12.574-3.072a9.004 9.004 0 00-12.574 0M14.121 8.464A9.004 9.004 0 0112 7.5c-2.43 0-4.63.92-6.287 2.464" /></svg>;
const PkrIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 4h4m5 6H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z" /></svg>;

// --- MLM Diagram Component ---
const MLMDiagram = () => ( /* Unchanged from previous version */ <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700"><svg viewBox="0 0 500 320" className="w-full max-w-2xl"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#16a34a" /></marker><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: 'rgb(59, 130, 246)', stopOpacity:1}} /><stop offset="100%" style={{stopColor: 'rgb(37, 99, 235)', stopOpacity:1}} /></linearGradient><linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: 'rgb(16, 185, 129)', stopOpacity:1}} /><stop offset="100%" style={{stopColor: 'rgb(5, 150, 105)', stopOpacity:1}} /></linearGradient><linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: 'rgb(139, 92, 246)', stopOpacity:1}} /><stop offset="100%" style={{stopColor: 'rgb(124, 58, 237)', stopOpacity:1}} /></linearGradient><linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: 'rgb(239, 68, 68)', stopOpacity:1}} /><stop offset="100%" style={{stopColor: 'rgb(220, 38, 38)', stopOpacity:1}} /></linearGradient><linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: 'rgb(245, 158, 11)', stopOpacity:1}} /><stop offset="100%" style={{stopColor: 'rgb(217, 119, 6)', stopOpacity:1}} /></linearGradient></defs><line x1="250" y1="55" x2="150" y2="73" stroke="#9ca3af" strokeWidth="2"/><line x1="150" y1="117" x2="100" y2="135" stroke="#cbd5e1" strokeWidth="1.5"/><line x1="150" y1="117" x2="200" y2="135" stroke="#cbd5e1" strokeWidth="1.5"/><line x1="100" y1="177" x2="50" y2="195" stroke="#e2e8f0" strokeWidth="1"/><line x1="100" y1="177" x2="150" y2="195" stroke="#e2e8f0" strokeWidth="1"/><line x1="50" y1="237" x2="25" y2="255" stroke="#e2e8f0" strokeWidth="1"/><line x1="50" y1="237" x2="75" y2="255" stroke="#e2e8f0" strokeWidth="1"/><line x1="250" y1="55" x2="350" y2="73" stroke="#9ca3af" strokeWidth="2"/><line x1="350" y1="117" x2="300" y2="135" stroke="#cbd5e1" strokeWidth="1.5"/><line x1="350" y1="117" x2="400" y2="135" stroke="#cbd5e1" strokeWidth="1.5"/><line x1="400" y1="177" x2="350" y2="195" stroke="#e2e8f0" strokeWidth="1"/><line x1="400" y1="177" x2="450" y2="195" stroke="#e2e8f0" strokeWidth="1"/><line x1="450" y1="237" x2="425" y2="255" stroke="#e2e8f0" strokeWidth="1"/><line x1="450" y1="237" x2="475" y2="255" stroke="#e2e8f0" strokeWidth="1"/><g><path d="M75 275 C 75 220, 150 150, 240 55" stroke="#16a34a" strokeWidth="2" fill="none" strokeDasharray="4,4" markerEnd="url(#arrowhead)" /><text x="95" y="240" fill="#10b981" fontSize="14" fontWeight="bold">$</text><text x="135" y="180" fill="#10b981" fontSize="14" fontWeight="bold">$</text><text x="180" y="120" fill="#10b981" fontSize="14" fontWeight="bold">$</text></g><g><circle cx="250" cy="30" r="25" fill="url(#grad1)" /><text x="250" y="35" fontFamily="sans-serif" fontSize="12" fill="white" textAnchor="middle">You</text></g><g><circle cx="150" cy="95" r="22" fill="url(#grad2)" /><text x="150" y="93" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Direct Ref</text><text x="150" y="103" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User A)</text></g><g><circle cx="100" cy="155" r="20" fill="url(#grad3)" /><text x="100" y="152" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 2</text><text x="100" y="162" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User B)</text></g><g><circle cx="200" cy="155" r="14" fill="url(#grad3)" /><text x="200" y="157" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 2</text></g><g><circle cx="50" cy="215" r="18" fill="url(#grad4)" /><text x="50" y="212" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 3</text><text x="50" y="222" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User C)</text></g><g><circle cx="150" cy="215" r="12" fill="url(#grad4)" /><text x="150" y="218" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 3</text></g><g><circle cx="25" cy="275" r="16" fill="url(#grad5)" /><text x="25" y="272" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 4</text><text x="25" y="282" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User D)</text></g><g><circle cx="75" cy="275" r="10" fill="url(#grad5)" /><text x="75" y="278" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 4</text></g><g><circle cx="350" cy="95" r="22" fill="url(#grad2)" /><text x="350" y="93" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Direct Ref</text><text x="350" y="103" fontFamily="sans-serif" fontSize="10" fill="white" textAnchor="middle">(User E)</text></g><g><circle cx="400" cy="155" r="20" fill="url(#grad3)" /><text x="400" y="152" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 2</text><text x="400" y="162" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User F)</text></g><g><circle cx="300" cy="155" r="14" fill="url(#grad3)" /><text x="300" y="157" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 2</text></g><g><circle cx="450" cy="215" r="18" fill="url(#grad4)" /><text x="450" y="212" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 3</text><text x="450" y="222" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User G)</text></g><g><circle cx="350" cy="215" r="12" fill="url(#grad4)" /><text x="350" y="218" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 3</text></g><g><circle cx="475" cy="275" r="16" fill="url(#grad5)" /><text x="475" y="272" fontFamily="sans-serif" fontSize="8" fill="white" textAnchor="middle">Level 4</text><text x="475" y="282" fontFamily="sans-serif" fontSize="9" fill="white" textAnchor="middle">(User H)</text></g><g><circle cx="425" cy="275" r="10" fill="url(#grad5)" /><text x="425" y="278" fontFamily="sans-serif" fontSize="7" fill="white" textAnchor="middle">Lvl 4</text></g></svg></div>);


const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useData();
    const { settings, investmentPlans } = state;

    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [pageContent, setPageContent] = useState<Partial<HomepageContent>>(settings.homepageContent || {});

    useEffect(() => {
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const params = new URLSearchParams(hash.substring(queryIndex));
            if (params.get('edit') === 'true') {
                setEditMode(true);
            }
        }
    }, []);

     useEffect(() => {
        setPageContent(settings.homepageContent || {});
        setIsDirty(false);
    }, [settings.homepageContent]);

    const handleContentChange = (field: keyof HomepageContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setPageContent(prev => ({ ...prev, [field]: e.target.value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // FIX: Cast pageContent to HomepageContent to satisfy the type requirement of the settings object.
            const updatedSettings = { ...settings, homepageContent: pageContent as HomepageContent };
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
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen">
            {editMode && <EditBar onSave={handleSave} onExit={exitEditMode} isSaving={isSaving} isDirty={isDirty}/>}

            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">SmartEarning</h1>
                        <nav className="hidden md:flex items-center space-x-2">
                            <Button variant="secondary" onClick={() => navigate('/login')}>Login</Button>
                            <Button onClick={() => navigate('/register')}>Sign Up</Button>
                        </nav>
                        <div className="md:hidden">
                            <Button size="sm" onClick={() => navigate('/login')}>Login</Button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative py-24 md:py-32 text-center overflow-hidden bg-white dark:bg-gray-800">
                    <div className="absolute inset-0 bg-grid-gray-200/50 dark:bg-grid-gray-700/30 [mask-image:linear-gradient(to_bottom,white_50%,transparent_100%)]"></div>
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                        <EditableText editMode={editMode} value={pageContent.heroTitle || ''} onChange={handleContentChange('heroTitle')} tag="h2" className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight" />
                        <EditableText editMode={editMode} value={pageContent.heroSubtitle || ''} onChange={handleContentChange('heroSubtitle')} tag="p" multiline className="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto" />
                        <div className="mt-10">
                            <Button size="lg" onClick={() => navigate('/register')} className="shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20">Get Started Now</Button>
                        </div>
                    </div>
                </section>

                 {/* Features Section */}
                <section className="py-16">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4"><SecureIcon/></div>
                                <EditableText editMode={editMode} value={pageContent.feature1Title || ''} onChange={handleContentChange('feature1Title')} tag="h4" className="text-xl font-bold" />
                                <EditableText editMode={editMode} value={pageContent.feature1Desc || ''} onChange={handleContentChange('feature1Desc')} multiline className="mt-2 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4"><NetworkIcon/></div>
                                <EditableText editMode={editMode} value={pageContent.feature2Title || ''} onChange={handleContentChange('feature2Title')} tag="h4" className="text-xl font-bold" />
                                <EditableText editMode={editMode} value={pageContent.feature2Desc || ''} onChange={handleContentChange('feature2Desc')} multiline className="mt-2 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4"><GrowthIcon/></div>
                                <EditableText editMode={editMode} value={pageContent.feature3Title || ''} onChange={handleContentChange('feature3Title')} tag="h4" className="text-xl font-bold" />
                                <EditableText editMode={editMode} value={pageContent.feature3Desc || ''} onChange={handleContentChange('feature3Desc')} multiline className="mt-2 text-gray-500 dark:text-gray-400" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Video Showcase Section */}
                {settings.homepageVideoUrl && (
                    <section className="py-16 bg-white dark:bg-gray-800">
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="text-center mb-12">
                                <EditableText editMode={editMode} value={pageContent.videoTitle || ''} onChange={handleContentChange('videoTitle')} tag="h2" className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" />
                                <EditableText editMode={editMode} value={pageContent.videoDesc || ''} onChange={handleContentChange('videoDesc')} multiline className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                            </div>
                            <div className="aspect-w-16 aspect-h-9 max-w-4xl mx-auto rounded-lg overflow-hidden shadow-2xl border-4 border-gray-200 dark:border-gray-700">
                                <iframe
                                    className="w-full h-full"
                                    src={settings.homepageVideoUrl}
                                    title="Platform Showcase Video"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen>
                                </iframe>
                            </div>
                        </div>
                    </section>
                )}

                {/* Multi-Currency Section */}
                <section className="py-16 bg-white dark:bg-gray-800">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <EditableText editMode={editMode} value={pageContent.multiCurrencyTitle || ''} onChange={handleContentChange('multiCurrencyTitle')} tag="h2" className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" />
                            <EditableText editMode={editMode} value={pageContent.multiCurrencyDesc || ''} onChange={handleContentChange('multiCurrencyDesc')} multiline className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-lg text-center border border-gray-200 dark:border-gray-700">
                                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full inline-block mb-4"><UsdIcon/></div>
                                <h4 className="text-xl font-bold mb-2">US Dollar (USD)</h4>
                                <p className="text-gray-600 dark:text-gray-300">Access a wide range of investment plans priced in USD. All your earnings from our global network are automatically converted and can be withdrawn directly to your preferred US Dollar payment methods.</p>
                            </div>
                             <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-lg text-center border border-gray-200 dark:border-gray-700">
                                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full inline-block mb-4"><EurIcon/></div>
                                <h4 className="text-xl font-bold mb-2">Euro (EUR)</h4>
                                <p className="text-gray-600 dark:text-gray-300">For our European members, all plans and transactions are available in Euros. Refer members from any country and receive your commissions seamlessly in EUR, ready for withdrawal.</p>
                            </div>
                             <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-lg text-center border border-gray-200 dark:border-gray-700">
                                <div className="p-4 bg-teal-100 dark:bg-teal-900/30 rounded-full inline-block mb-4"><PkrIcon/></div>
                                <h4 className="text-xl font-bold mb-2">Pakistani Rupee (PKR)</h4>
                                <p className="text-gray-600 dark:text-gray-300">We offer dedicated plans and local payment methods for our members in Pakistan. Invest and withdraw in PKR, while still earning from referrals using any currency on the platform.</p>
                            </div>
                        </div>
                    </div>
                </section>


                {/* MLM Explanation Section */}
                <section className="py-16">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <EditableText editMode={editMode} value={pageContent.mlmTitle || ''} onChange={handleContentChange('mlmTitle')} tag="h2" className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" />
                            <EditableText editMode={editMode} value={pageContent.mlmDesc || ''} onChange={handleContentChange('mlmDesc')} multiline className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h3 className="text-2xl font-semibold mb-4">How It Works</h3>
                                <p className="mb-4 text-gray-600 dark:text-gray-300">
                                    Think of it like building a team. Your network has multiple levels, and you earn commissions from each:
                                </p>
                                <ul className="space-y-4 mb-4">
                                    <li><strong>Level 1 (Direct Referrals):</strong> You earn a commission when you personally invite someone to join.</li>
                                    <li><strong>Level 2 (Indirect Referrals):</strong> When your Level 1 referral invites a new member, you also earn a commission.</li>
                                    <li><strong>Deeper Levels (3, 4, etc.):</strong> The process continues. You earn a commission when your Level 2 referrals bring in new members (your Level 3), and when your Level 3 referrals bring in members (your Level 4), and so on.</li>
                                </ul>
                                <p className="mb-4 text-gray-600 dark:text-gray-300">This creates a powerful ripple effect, rewarding you for your leadership as your network grows. The bigger and more active your team, the higher your earning potential.</p>
                                <ul className="space-y-3">
                                    <li className="flex"><CheckIcon /> <strong>Direct Commission (Level 1):</strong> Earned from the people you personally refer.</li>
                                    <li className="flex"><CheckIcon /> <strong>Indirect Commission (Level 2+):</strong> Earned from the referrals made by your team members, their team members, and so on.</li>
                                    <li className="flex"><CheckIcon /> <strong>Unlimited Growth:</strong> The bigger and more active your network, the higher your potential earnings.</li>
                                </ul>
                            </div>
                             <MLMDiagram />
                        </div>
                    </div>
                </section>

                {/* Investment Plans Section */}
                {featuredPlans.length > 0 && (
                    <section className="py-16 bg-white dark:bg-gray-800">
                        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                            <h3 className="text-3xl font-bold text-center mb-10">Our Top Investment Plans</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {featuredPlans.map(plan => (
                                    <div key={plan._id} className="border dark:border-gray-700 rounded-xl p-8 shadow-lg flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                                        <h4 className="text-2xl font-bold mb-2">{plan.name}</h4>
                                        <p className="text-5xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">{formatCurrency(plan.price, plan.currency)}</p>
                                        <p className="text-gray-500 dark:text-gray-400 mb-6 flex-grow">{plan.description}</p>
                                        <ul className="space-y-3 text-sm mb-8 border-t dark:border-gray-700 pt-6">
                                            <li className="flex items-center"><CheckIcon /> Duration: {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</li>
                                            <li className="flex items-center"><CheckIcon /> Min. Withdraw: {formatCurrency(plan.minWithdraw, plan.currency)}</li>
                                            <li className="flex items-center"><CheckIcon /> Direct Commission: {renderDirectCommission(plan)}</li>
                                        </ul>
                                        <Button className="w-full mt-auto" onClick={() => navigate('/register')}>Choose Plan</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Final CTA */}
                <section className="py-20">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <EditableText editMode={editMode} value={pageContent.ctaTitle || ''} onChange={handleContentChange('ctaTitle')} tag="h2" className="text-3xl font-bold text-gray-900 dark:text-white" />
                        <EditableText editMode={editMode} value={pageContent.ctaDesc || ''} onChange={handleContentChange('ctaDesc')} multiline className="mt-3 text-lg text-gray-600 dark:text-gray-300" />
                        <div className="mt-8">
                            <Button size="lg" onClick={() => navigate('/register')}>Create Your Account</Button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-500 dark:text-gray-400">
                    <p>&copy; {new Date().getFullYear()} SmartEarning. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;