import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { useWorkAndEarnConfig } from '../hooks/useWorkAndEarnConfig';
import { formatCurrency } from '../types';
import Button from './ui/Button';
import Modal from './ui/Modal';
import {
    Layers as TaskIcon,
    Globe as GlobeIcon,
    Search as SearchIcon,
    Clock as ClockIcon,
    ExternalLink as LaunchIcon,
    HelpCircle as InfoIcon,
    Sparkles as SparklesIcon,
    X as CloseIcon
} from 'lucide-react';

export interface JobGig {
    id: string;
    title: string;
    provider: string;
    providerKey: 'smart-exn' | 'cpalead' | '2row' | 'x' | 'pollfish' | 'adgate' | string;
    category: 'Available Jobs' | 'Other Tasks';
    subTabKey?: string;
    rewardUSD: number;
    estimatedTime: string;
    difficulty: 'Very Easy' | 'Easy' | 'Medium' | 'Quick';
    description: string;
    instructions: string[];
    actionLabel: string;
    actionUrl?: string;
    requiresProof?: boolean;
    proofType?: 'screenshot' | 'text' | 'none';
}

export const DEFAULT_GIGS: JobGig[] = [
    // Other Tasks -> CPALead
    {
        id: 'cpa-1',
        title: 'Install & Test Free Mobile Wallet App (Android/iOS)',
        provider: 'CPALead',
        providerKey: 'cpalead',
        category: 'Other Tasks',
        subTabKey: 'cpalead',
        rewardUSD: 1.50,
        estimatedTime: '3 mins',
        difficulty: 'Easy',
        description: 'Download the partner mobile app from App Store or Play Store, open it for 30 seconds, and register.',
        instructions: [
            'Click "Download App" to navigate to CPALead offer link.',
            'Install the app from Google Play or Apple App Store.',
            'Open the app and keep it active for at least 30 seconds.',
            'Submit your registered email or username for instant reward credit.'
        ],
        actionLabel: 'Download App',
        actionUrl: 'https://cpalead.com',
        requiresProof: true,
        proofType: 'text'
    },
    {
        id: 'cpa-2',
        title: 'Register & Verify Free Opinion Panel Account',
        provider: 'CPALead',
        providerKey: 'cpalead',
        category: 'Other Tasks',
        subTabKey: 'cpalead',
        rewardUSD: 1.10,
        estimatedTime: '3 mins',
        difficulty: 'Very Easy',
        description: 'Sign up for a free consumer opinion panel account and click the confirmation email link.',
        instructions: [
            'Click "Register Panel" to open the registration form.',
            'Fill out your basic details and sign up.',
            'Check your email inbox and click the email verification link.',
            'Click "I Completed This" to receive reward in Task Wallet.'
        ],
        actionLabel: 'Register Panel',
        actionUrl: 'https://cpalead.com',
        requiresProof: false
    },

    // Other Tasks -> 2row
    {
        id: '2row-1',
        title: '2row Institutional Global Consumer Electronics Survey',
        provider: '2row',
        providerKey: '2row',
        category: 'Other Tasks',
        subTabKey: '2row',
        rewardUSD: 2.10,
        estimatedTime: '8 mins',
        difficulty: 'Medium',
        description: 'Participate in 2row research study evaluating smartphone & laptop purchasing choices.',
        instructions: [
            'Click "Start 2row Survey" to begin.',
            'Answer demographic questions truthfully.',
            'Complete all survey pages until the Thank You completion screen.',
            'The 2row postback system will automatically credit your account upon finish.'
        ],
        actionLabel: 'Start 2row Survey',
        actionUrl: 'https://bitlabs.ai',
        requiresProof: false
    },
    {
        id: '2row-2',
        title: '2row Digital Banking & Crypto Habits Poll',
        provider: '2row',
        providerKey: '2row',
        category: 'Other Tasks',
        subTabKey: '2row',
        rewardUSD: 1.75,
        estimatedTime: '5 mins',
        difficulty: 'Easy',
        description: 'Short market research poll on mobile banking apps and cross-border remittance.',
        instructions: [
            'Click "Launch Poll".',
            'Provide honest feedback regarding your preferred remittance tools.',
            'Click verify on completion.'
        ],
        actionLabel: 'Launch Poll',
        actionUrl: 'https://bitlabs.ai',
        requiresProof: false
    },

    // Other Tasks -> X (Twitter)
    {
        id: 'x-1',
        title: 'Repost & Bookmark SmartExn Global Announcement on X',
        provider: 'X (Twitter)',
        providerKey: 'x',
        category: 'Other Tasks',
        subTabKey: 'x',
        rewardUSD: 0.70,
        estimatedTime: '1 min',
        difficulty: 'Quick',
        description: 'Repost (Retweet) the latest SmartExn launch post on X and bookmark it.',
        instructions: [
            'Click "Open Post on X".',
            'Click the Repost button and Bookmark the post.',
            'Copy your repost URL or enter your X handle below.',
            'Submit proof for instant credit.'
        ],
        actionLabel: 'Open Post on X',
        actionUrl: 'https://x.com',
        requiresProof: true,
        proofType: 'text'
    },
    {
        id: 'x-2',
        title: 'Comment & Tag 2 Friends on X Tech Discussion',
        provider: 'X (Twitter)',
        providerKey: 'x',
        category: 'Other Tasks',
        subTabKey: 'x',
        rewardUSD: 0.95,
        estimatedTime: '2 mins',
        difficulty: 'Very Easy',
        description: 'Leave a positive comment on the X thread and tag two crypto/gig enthusiast friends.',
        instructions: [
            'Open X post link.',
            'Write a thoughtful comment and tag 2 friends.',
            'Paste your comment link or username in the box below.'
        ],
        actionLabel: 'Join X Discussion',
        actionUrl: 'https://x.com',
        requiresProof: true,
        proofType: 'text'
    },

    // Other Tasks -> Pollfish
    {
        id: 'poll-1',
        title: 'Streaming Entertainment & Media Consumption Poll',
        provider: 'Pollfish',
        providerKey: 'pollfish',
        category: 'Other Tasks',
        subTabKey: 'pollfish',
        rewardUSD: 1.25,
        estimatedTime: '5 mins',
        difficulty: 'Easy',
        description: 'Interactive Pollfish survey with guaranteed payout on valid completion.',
        instructions: [
            'Click "Start Pollfish Survey".',
            'Answer questions continuously without closing tab.',
            'Get credited immediately upon reaching completion screen.'
        ],
        actionLabel: 'Start Pollfish Survey',
        actionUrl: 'https://pollfish.com',
        requiresProof: false
    },

    // Other Tasks -> AdGate
    {
        id: 'adgate-1',
        title: 'Play "Block Master" & Reach Level 10',
        provider: 'AdGate Media',
        providerKey: 'adgate',
        category: 'Other Tasks',
        subTabKey: 'adgate',
        rewardUSD: 3.50,
        estimatedTime: '15 mins',
        difficulty: 'Medium',
        description: 'Fun mobile casual puzzle game offerwall. Pass Level 10 within 3 days.',
        instructions: [
            'Install game through AdGate offerwall link.',
            'Play through and finish level 10.',
            'Rewards credit automatically into your Task Wallet.'
        ],
        actionLabel: 'Play Game',
        actionUrl: 'https://adgatemedia.com',
        requiresProof: false
    }
];

export interface OtherTasksCardProps {
    className?: string;
    hideHeader?: boolean;
}

export const OtherTasksCard: React.FC<OtherTasksCardProps> = ({ className = '', hideHeader = false }) => {
    const { state, dispatch } = useData();
    const { currentUser } = state;
    const workAndEarnConfig = useWorkAndEarnConfig();

    const [activeSubTab, setActiveSubTab] = useState<string>('cpalead');
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter] = useState<string>('all');

    const [selectedGig, setSelectedGig] = useState<JobGig | null>(null);
    const [proofInput, setProofInput] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const exchangeRate = state.settings?.exchangeRates?.[currentUser?.currency || 'USD'] || 1;

    // Custom Tabs & Sub-Tabs from Admin Settings
    const customEarnTabs = state.settings?.customEarnTabs || [];
    const otherTasksTabConfig = customEarnTabs.find(t => t.id === 'other_tasks' || t.title.toLowerCase().includes('other'));

    const subTabs = useMemo(() => {
        const defaultSubTabs = [
            { id: 'cpalead', name: 'CP lead', providerKey: 'cpalead', badge: 'CP Lead' },
            { id: '2row', name: '2row', providerKey: '2row', badge: '2row' },
            { id: 'x', name: 'X', providerKey: 'x', badge: 'X (Twitter)' },
            { id: 'pollfish', name: 'Pollfish', providerKey: 'pollfish', badge: 'Polls' },
            { id: 'adgate', name: 'AdGate Media', providerKey: 'adgate', badge: 'Offerwall' }
        ];

        if (otherTasksTabConfig && otherTasksTabConfig.subTabs && otherTasksTabConfig.subTabs.length > 0) {
            const adminTabs = otherTasksTabConfig.subTabs.map(st => ({
                id: st.id,
                name: st.name,
                providerKey: st.providerKey || st.id,
                badge: st.badge || st.name
            }));

            const merged = [...defaultSubTabs];
            adminTabs.forEach(at => {
                if (!merged.some(m => m.id === at.id || m.name.toLowerCase() === at.name.toLowerCase())) {
                    merged.push(at);
                }
            });
            return merged;
        }

        return defaultSubTabs;
    }, [otherTasksTabConfig]);

    // Filter Offerwall Gigs according to Tab, Search, and Difficulty
    const filteredOfferwallGigs = useMemo(() => {
        return DEFAULT_GIGS.filter(gig => {
            if (activeSubTab) {
                const matchSub = gig.subTabKey === activeSubTab ||
                    gig.providerKey.toLowerCase() === activeSubTab.toLowerCase() ||
                    gig.provider.toLowerCase().includes(activeSubTab.toLowerCase());
                if (!matchSub) return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesQ = gig.title.toLowerCase().includes(q) ||
                    gig.provider.toLowerCase().includes(q) ||
                    gig.description.toLowerCase().includes(q);
                if (!matchesQ) return false;
            }

            if (difficultyFilter !== 'all' && gig.difficulty.toLowerCase() !== difficultyFilter.toLowerCase()) {
                return false;
            }

            return true;
        });
    }, [activeSubTab, searchQuery, difficultyFilter]);

    // Handle Gig Proof Submission & Instant Wallet Credit
    const handleSubmitGigProof = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGig || !currentUser) return;

        if (selectedGig.requiresProof) {
            if (selectedGig.proofType === 'screenshot' && !proofFile && !proofInput) {
                alert('Please upload a screenshot or provide proof URL before submitting.');
                return;
            }
            if (selectedGig.proofType === 'text' && !proofInput.trim()) {
                alert('Please enter your proof text or username before submitting.');
                return;
            }
        }

        setIsSubmittingTask(true);
        try {
            const newBalance = (currentUser.taskEarningsBalance || 0) + selectedGig.rewardUSD;
            const nowIso = new Date().toISOString();
            const gigSubId = 'gig_sub_' + Date.now();
            const gigTrxId = 'trx_gig_' + Date.now();

            // 1. Record task submission in history state
            dispatch({
                type: 'ADD_USER_TASK_SUBMISSION',
                payload: {
                    _id: gigSubId,
                    taskId: selectedGig.id,
                    taskTitle: selectedGig.title,
                    taskCategory: selectedGig.category,
                    workerId: currentUser._id,
                    workerName: currentUser.fullName || currentUser.username,
                    rewardAmount: selectedGig.rewardUSD,
                    currency: 'USD',
                    status: 'Approved',
                    proofText: proofInput || 'Instant offerwall completion',
                    createdAt: nowIso
                }
            });

            // 2. Record transaction in state
            dispatch({
                type: 'ADD_TRANSACTION',
                payload: {
                    _id: gigTrxId,
                    userId: currentUser._id,
                    userName: currentUser.username || currentUser.fullName || 'User',
                    type: 'Task Reward',
                    amount: selectedGig.rewardUSD,
                    currency: 'USD',
                    exchangeRate: exchangeRate,
                    description: `Reward credited for completing job: ${selectedGig.title}`,
                    status: 'Approved',
                    date: nowIso
                }
            });

            // 3. Update User Task Earnings balance
            dispatch({
                type: 'UPDATE_USER',
                payload: {
                    ...currentUser,
                    taskEarningsBalance: newBalance
                }
            });

            setSelectedGig(null);
            setProofInput('');
            setProofFile(null);
            setSuccessMessage(`🎉 Job Completed! $${selectedGig.rewardUSD.toFixed(2)} USD credited directly to your Task Earnings Wallet.`);
            setTimeout(() => setSuccessMessage(null), 6000);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const activeNetworkName = subTabs.find(s => s.id === activeSubTab)?.name || 'Partner';

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Top Toast Notice */}
            {successMessage && (
                <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in border border-emerald-400/50">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 animate-spin" />
                        <span className="font-bold text-sm sm:text-base">{successMessage}</span>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-white hover:opacity-80 p-1">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Sub-Tabs (Networks) and Search Controls */}
            <div className="bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl border border-slate-800 space-y-3 sm:space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                            <GlobeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                                Partner Networks & External Tasks
                            </h4>
                            <p className="text-[10px] sm:text-xs text-slate-400">
                                Select an offerwall provider to browse available surveys and tasks.
                            </p>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full md:w-64">
                        <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl sm:rounded-2xl pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Sub-Tabs for "Other Tasks" */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pt-0.5 sm:pt-1">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 sm:mr-2 shrink-0">Networks:</span>
                    {subTabs.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => setActiveSubTab(sub.id)}
                            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                                activeSubTab === sub.id
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <span>{sub.name}</span>
                            {sub.badge && (
                                <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 rounded-md font-mono ${
                                    activeSubTab === sub.id ? 'bg-slate-950/80 text-amber-300 font-bold' : 'bg-slate-950/60 text-slate-400'
                                }`}>
                                    {sub.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT CARD: OTHER TASKS GRID */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-xl space-y-3 sm:space-y-4">
                {!hideHeader && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3 sm:pb-4">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                                <GlobeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 truncate">
                                    {activeNetworkName} Offers & External Tasks
                                </h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                                    Complete surveys, app installs, and partner activities across selected offer networks.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl">
                                {filteredOfferwallGigs.length} Offers Available
                            </span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                    {filteredOfferwallGigs.length > 0 ? (
                        filteredOfferwallGigs.map(gig => (
                            <div
                                key={gig.id}
                                className="bg-slate-950/80 rounded-2xl p-5 shadow-lg border border-slate-800/80 flex flex-col justify-between hover:border-amber-500/50 transition-all group space-y-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-xl uppercase tracking-wider">
                                            {gig.provider}
                                        </span>
                                        <span className="text-emerald-400 font-bold text-sm sm:text-base text-right font-mono">
                                            +{formatCurrency(gig.rewardUSD * exchangeRate, currentUser?.currency || 'USD')}
                                            {currentUser?.currency !== 'USD' && (
                                                <span className="text-[10px] text-slate-400 font-semibold block font-mono">(${gig.rewardUSD.toFixed(2)} USD)</span>
                                            )}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-amber-300 transition-colors">
                                        {gig.title}
                                    </h4>

                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                        {gig.description}
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-slate-800/80 space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold flex items-center gap-1 text-slate-400">
                                            <ClockIcon className="w-3.5 h-3.5 text-slate-500" /> {gig.estimatedTime}
                                        </span>
                                        <span className="text-amber-400 font-bold text-[11px] font-mono">{gig.difficulty}</span>
                                    </div>

                                    <button
                                        onClick={() => setSelectedGig(gig)}
                                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-2 min-h-[40px]"
                                    >
                                        <span>Start Offer & Do Task</span>
                                        <LaunchIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-slate-950/80 rounded-2xl border border-dashed border-slate-800 space-y-3">
                            <InfoIcon className="w-10 h-10 mx-auto text-slate-500" />
                            <h4 className="font-bold text-slate-300 text-sm">No active offers for this category yet</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                New partner tasks are synchronized daily. Please check back soon or try another network sub-tab above.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* OFFERWALL GIG DETAIL MODAL */}
            {selectedGig && currentUser && (
                <Modal isOpen={true} onClose={() => setSelectedGig(null)} title={selectedGig.title}>
                    <div className="space-y-5 p-1">
                        <div className="bg-slate-950/90 p-4 rounded-2xl flex items-center justify-between border border-slate-800">
                            <div>
                                <span className="text-xs text-slate-400 uppercase font-bold block">Network / Provider</span>
                                <span className="font-bold text-amber-300 text-sm">{selectedGig.provider}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-400 uppercase font-bold block">Task Reward</span>
                                <span className="font-extrabold text-emerald-400 text-base sm:text-lg font-mono">
                                    +{formatCurrency(selectedGig.rewardUSD * exchangeRate, currentUser.currency)}
                                    {currentUser.currency !== 'USD' && (
                                        <span className="text-xs font-semibold text-slate-400 block font-mono">(${selectedGig.rewardUSD.toFixed(2)} USD)</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Task Overview</h4>
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
                                {selectedGig.description}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Step-by-Step Instructions</h4>
                            <ul className="space-y-2 text-xs text-slate-300">
                                {selectedGig.instructions.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2.5 bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
                                        <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                            {idx + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <form onSubmit={handleSubmitGigProof} className="space-y-4 pt-3 border-t border-slate-800">
                            {selectedGig.actionUrl && (
                                <a
                                    href={selectedGig.actionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 min-h-[40px]"
                                >
                                    <span>{selectedGig.actionLabel || 'Open Task Link'}</span>
                                    <LaunchIcon className="w-4 h-4" />
                                </a>
                            )}

                            {selectedGig.requiresProof && (
                                <div className="space-y-2.5 pt-1">
                                    <label className="block text-xs font-bold uppercase text-slate-300">Submit Required Proof</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Enter your registered username, email, or completion proof details..."
                                        value={proofInput}
                                        onChange={(e) => setProofInput(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            )}

                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider min-h-[44px]"
                                disabled={isSubmittingTask}
                            >
                                {isSubmittingTask ? 'Submitting Proof...' : 'Complete & Claim Reward'}
                            </Button>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OtherTasksCard;
