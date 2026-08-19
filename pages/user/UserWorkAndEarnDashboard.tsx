import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useData } from '../../hooks/useData';
import UserTasksSubmit, { getRemainingTimeString } from './UserTasksSubmit';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { 
    Wallet as WalletIcon, 
    ArrowRightLeft as ConvertIcon, 
    ArrowRightLeft,
    ArrowDownCircle as DepositIcon,
    ArrowUpCircle as WithdrawalIcon,
    CheckCircle2 as ApprovedIcon, 
    Clock as PendingIcon, 
    Clock as ClockIcon,
    ExternalLink as LaunchIcon,
    DollarSign as DollarIcon,
    Award as RewardIcon,
    Play as PlayIcon,
    Pause as PauseIcon,
    Trash2 as TrashIcon,
    Layers as TaskIcon,
    HelpCircle as InfoIcon,
    Search as SearchIcon,
    Sparkles as SparklesIcon,
    PlusCircle as PlusIcon,
    Zap as ZapIcon,
    Globe as GlobeIcon,
    UploadCloud as UploadIcon,
    Check as CheckIcon,
    AlertCircle as AlertIcon,
    Share2 as ShareIcon,
    Shield as ShieldIcon,
    User as UserIcon,
    Star as StarIcon,
    ListFilter as FilterIcon,
    ChevronRight as ChevronRightIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronsLeft as ChevronsLeftIcon,
    ChevronsRight as ChevronsRightIcon,
    ChevronDown as ChevronDownIcon,
    ChevronUp as ChevronUpIcon,
    X as CloseIcon,
    FileText as FileTextIcon,
    Image as ImageIcon,
    History as HistoryIcon,
    FolderKanban as CampaignIcon,
    Send as SendIcon,
    AlertTriangle as DisputeIcon,
    Copy as CopyIcon,
    Home as HomeIcon,
    TrendingUp as TrendingUpIcon,
    Users as UsersIcon,
    Megaphone as MegaphoneIcon
} from 'lucide-react';
import { useWorkAndEarnConfig } from '../../hooks/useWorkAndEarnConfig';
import { formatCurrency, currencySymbols, UserTask, UserTaskSubmission } from '../../types';
import { 
    convertUserCurrency, 
    convertTaskWalletBalance, 
    submitUserTaskProof, 
    updateUserTaskStatus, 
    deleteUserTask, 
    openTaskDispute 
} from '../../services/api';

interface JobGig {
    id: string;
    title: string;
    provider: string; // e.g. 'smart-exn.com', 'CPALead', '2row', 'X (Twitter)', 'Pollfish', 'AdGate'
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

const DEFAULT_GIGS: JobGig[] = [
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

const UserWorkAndEarnDashboard: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, userTasks = [], userTaskSubmissions = [], tasks = [], transactions = [], deposits = [], withdrawals = [] } = state;
    const navigate = useNavigate();

    // Primary Tabs
    const [dashboardTab, setDashboardTab] = useState<'available_jobs' | 'other_tasks'>('available_jobs');

    // Sub-tab for "Other Tasks"
    const [activeSubTab, setActiveSubTab] = useState<string>('cpalead');

    // Search and Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

    // Offerwall Gig Modal
    const [selectedGig, setSelectedGig] = useState<JobGig | null>(null);
    const [proofInput, setProofInput] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // UserTask Proof Submission Modal (From Earn Cash & Gig Hub)
    const [proofTask, setProofTask] = useState<UserTask | null>(null);
    const [taskProofText, setTaskProofText] = useState('');
    const [taskProofUsername, setTaskProofUsername] = useState('');
    const [taskProofUserIdVal, setTaskProofUserIdVal] = useState('');
    const [taskProofEmail, setTaskProofEmail] = useState('');
    const [taskProofImage, setTaskProofImage] = useState('');
    const [isSubmittingTaskProof, setIsSubmittingTaskProof] = useState(false);

    // Detail Modal for Submission
    const [selectedSubmissionDetail, setSelectedSubmissionDetail] = useState<UserTaskSubmission | null>(null);

    // Dispute Modal
    const [disputeSubmission, setDisputeSubmission] = useState<UserTaskSubmission | null>(null);
    const [disputeDescription, setDisputeDescription] = useState('');
    const [disputeProofImage, setDisputeProofImage] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Convert Modal States
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [convertAmount, setConvertAmount] = useState<string>('');
    const [isConverting, setIsConverting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Referral Copy State
    const [copiedReferral, setCopiedReferral] = useState(false);

    // Breakdown Accordion Toggle States
    const [showTaskEarningsBreakdown, setShowTaskEarningsBreakdown] = useState(false);
    const [showCampaignWalletBreakdown, setShowCampaignWalletBreakdown] = useState(false);

    const handleCopyReferral = () => {
        const code = currentUser?.referralCode || currentUser?.username || '';
        const refUrl = `${window.location.origin}/register?ref=${code}`;
        navigator.clipboard.writeText(refUrl);
        setCopiedReferral(true);
        setTimeout(() => setCopiedReferral(false), 2000);
    };

    const handleShareReferral = () => {
        const code = currentUser?.referralCode || currentUser?.username || '';
        const refUrl = `${window.location.origin}/register?ref=${code}`;
        if (navigator.share) {
            navigator.share({
                title: 'Join SmartExn Work & Earn',
                text: 'Earn money completing simple tasks and gigs!',
                url: refUrl
            }).catch(() => {});
        } else {
            handleCopyReferral();
        }
    };

    if (!currentUser) return null;

    // Currency Formatting & Exchange
    const getCurrencySymbol = () => currencySymbols[currentUser.currency] || '$';
    const exchangeRate = state.settings?.exchangeRates?.[currentUser.currency] || 1;

    // Custom Tabs from Admin Settings
    const customEarnTabs = state.settings?.customEarnTabs || [];
    const otherTasksTabConfig = customEarnTabs.find(t => t.id === 'other_tasks' || t.title.toLowerCase().includes('other'));

    // Dynamic Sub-Tabs for "Other Tasks"
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

    // Comprehensive Work & Earn Financial Calculations
    const userIdStr = currentUser._id?.toString();

    // Helper to check if a submission belongs to the current user as a worker
    const isWorkerSubmission = React.useCallback((s: any) => {
        if (!currentUser) return false;
        const cId = currentUser._id?.toString();
        const wId = typeof s.workerId === 'object' && s.workerId !== null ? s.workerId._id?.toString() : s.workerId?.toString();
        const uId = typeof s.userId === 'object' && s.userId !== null ? s.userId._id?.toString() : s.userId?.toString();
        const wName = (s.workerName || '').toLowerCase().trim();
        const cUsername = (currentUser.username || '').toLowerCase().trim();
        const cFullName = (currentUser.fullName || '').toLowerCase().trim();

        return Boolean(
            (wId && cId && wId === cId) ||
            (uId && cId && uId === cId) ||
            (cUsername && wName === cUsername) ||
            (cFullName && wName === cFullName)
        );
    }, [currentUser]);

    // Approved tasks or submissions for this user
    const approvedTaskSubmissions = useMemo(() => {
        return (userTaskSubmissions || []).filter(s => 
            isWorkerSubmission(s) && (s.status === 'Approved' || s.status === 'Paid')
        );
    }, [userTaskSubmissions, isWorkerSubmission]);

    const approvedTaskTrxs = useMemo(() => {
        return (transactions || []).filter(t => 
            t.userId?.toString() === userIdStr && 
            (t.type === 'Task Reward' || t.type === 'Micro-Task' || t.type === 'Task Completed' || t.description?.toLowerCase().includes('job completed') || t.description?.toLowerCase().includes('task reward')) &&
            (t.status === 'Approved' || t.status === 'Paid' || !t.status) &&
            !t.description?.toLowerCase().includes('deduction')
        );
    }, [transactions, userIdStr]);

    const totalSubmissionsEarningsUSD = useMemo(() => {
        return approvedTaskSubmissions.reduce((sum, s) => sum + (s.rewardAmount || 0), 0);
    }, [approvedTaskSubmissions]);
    
    // Sum standalone task transactions that aren't duplicate submission IDs
    const standaloneTrxEarningsUSD = useMemo(() => {
        return approvedTaskTrxs.reduce((sum, t) => {
            const txIdStr = String(t._id);
            const subIdStr = (t as any).submissionId ? String((t as any).submissionId) : null;
            const isDuplicate = approvedTaskSubmissions.some(s => 
                String(s._id) === txIdStr || 
                (subIdStr && String(s._id) === subIdStr) ||
                (s.rewardTransactionId && String(s.rewardTransactionId) === txIdStr)
            );
            if (isDuplicate) {
                return sum;
            }
            let amtUSD = 0;
            if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                amtUSD = Math.abs(t.amountUSD);
            } else if (t.currency && t.currency !== 'USD') {
                const amtBase = Math.abs(t.amount || 0);
                amtUSD = (t.exchangeRate || exchangeRate) > 0 ? amtBase / (t.exchangeRate || exchangeRate) : amtBase / (exchangeRate || 1);
            } else {
                amtUSD = Math.abs(t.amount || 0);
            }
            return sum + amtUSD;
        }, 0);
    }, [approvedTaskTrxs, approvedTaskSubmissions, exchangeRate]);

    // Total sum of all rewards from completed and rewarded tasks
    const totalLifetimeTaskEarningsUSD = useMemo(() => {
        const sumFromHistory = totalSubmissionsEarningsUSD + standaloneTrxEarningsUSD;
        return Math.max(sumFromHistory, currentUser.taskEarningsBalance || 0);
    }, [totalSubmissionsEarningsUSD, standaloneTrxEarningsUSD, currentUser.taskEarningsBalance]);

    // Calculate Hub Pending & Net Withdrawable Task Earnings
    const userHubWithdrawals = useMemo(() => {
        if (!userIdStr) return [];
        return (withdrawals || []).filter(w => 
            w.userId?.toString() === userIdStr && 
            ((w as any).isHub || (w as any).isTaskWallet || w.userNotes?.toLowerCase().includes('hub') || w.userNotes?.toLowerCase().includes('task'))
        );
    }, [withdrawals, userIdStr]);

    const pendingHubWithdrawalsUSD = useMemo(() => {
        return userHubWithdrawals
            .filter(w => w.status === 'Pending' || w.status === 'Matching')
            .reduce((sum, w) => {
                const amtUSD = w.currency && w.currency !== 'USD' ? (w.amount / (exchangeRate || 1)) : w.amount;
                return sum + (amtUSD || 0);
            }, 0);
    }, [userHubWithdrawals, exchangeRate]);

    const totalDeductedHubWithdrawalsUSD = useMemo(() => {
        return userHubWithdrawals
            .filter(w => w.status === 'Pending' || w.status === 'Matching' || w.status === 'Approved' || w.status === 'Paid')
            .reduce((sum, w) => {
                const amtUSD = w.currency && w.currency !== 'USD' ? (w.amount / (exchangeRate || 1)) : w.amount;
                return sum + (amtUSD || 0);
            }, 0);
    }, [userHubWithdrawals, exchangeRate]);

    const totalConvertedTaskEarningsUSD = useMemo(() => {
        return (transactions || []).reduce((sum, t) => {
            if (t.userId?.toString() !== userIdStr) return sum;
            if (t.status === 'Rejected' || t.status === 'Cancelled') return sum;

            const typeLower = (t.type || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();

            const isInvestmentTransfer = 
                typeLower.includes('investment to task') ||
                typeLower.includes('investment to campaign') ||
                typeLower.includes('investment wallet') ||
                descLower.includes('from investment wallet') ||
                descLower.includes('from investment module') ||
                descLower.includes('investment to task') ||
                descLower.includes('investment to campaign') ||
                descLower.includes('investment wallet to task wallet');

            if (isInvestmentTransfer) return sum;

            const isCampaign = descLower.includes('campaign') || typeLower.includes('campaign');

            const isConversionOrTransferOut = 
                !isCampaign && (
                    typeLower.includes('task wallet conversion') ||
                    typeLower.includes('task wallet transfer') ||
                    typeLower.includes('task earnings conversion') ||
                    typeLower.includes('task earnings transfer') ||
                    (descLower.includes('converted') && (descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('transferred') && (descLower.includes('task earnings') || descLower.includes('task wallet')))
                );

            if (isConversionOrTransferOut) {
                let amtUSD = 0;
                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    amtUSD = Math.abs(t.amountUSD);
                } else if (t.currency && t.currency !== 'USD') {
                    const amtBase = Math.abs(t.amount || 0);
                    amtUSD = (t.exchangeRate || exchangeRate) > 0 ? amtBase / (t.exchangeRate || exchangeRate) : amtBase / (exchangeRate || 1);
                } else {
                    amtUSD = Math.abs(t.amount || 0);
                }
                return sum + amtUSD;
            }
            return sum;
        }, 0);
    }, [transactions, userIdStr, exchangeRate]);

    // Dedicated Task Earnings Wallet Breakdown calculations
    const fundsUsedForCampaignUSD = useMemo(() => {
        return (transactions || []).reduce((sum, t) => {
            if (t.userId?.toString() !== userIdStr) return sum;
            if (t.status === 'Rejected' || t.status === 'Cancelled') return sum;

            const typeLower = (t.type || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();

            const isInvestmentTransfer = 
                typeLower.includes('investment to task') ||
                typeLower.includes('investment to campaign') ||
                typeLower.includes('investment wallet') ||
                descLower.includes('from investment wallet') ||
                descLower.includes('from investment module') ||
                descLower.includes('investment to task') ||
                descLower.includes('investment to campaign') ||
                descLower.includes('investment wallet to task wallet');

            const isCampaignTransferFromTaskEarnings = 
                !isInvestmentTransfer && (
                    typeLower.includes('task reward transfer') ||
                    (typeLower.includes('campaign') && (typeLower.includes('task') || descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('campaign') && (descLower.includes('task earnings') || descLower.includes('task wallet') || descLower.includes('converted') || descLower.includes('transferred')))
                );

            if (isCampaignTransferFromTaskEarnings) {
                let amtUSD = 0;
                if (t.amountUSD && Math.abs(t.amountUSD) > 0) {
                    amtUSD = Math.abs(t.amountUSD);
                } else if (t.currency && t.currency !== 'USD') {
                    const amtBase = Math.abs(t.amount || 0);
                    amtUSD = (t.exchangeRate || exchangeRate) > 0 ? amtBase / (t.exchangeRate || exchangeRate) : amtBase / (exchangeRate || 1);
                } else {
                    amtUSD = Math.abs(t.amount || 0);
                }
                return sum + amtUSD;
            }
            return sum;
        }, 0);
    }, [transactions, userIdStr, exchangeRate]);

    const fundConversionOrWithdrawalUSD = useMemo(() => {
        return Number((totalDeductedHubWithdrawalsUSD + totalConvertedTaskEarningsUSD).toFixed(2));
    }, [totalDeductedHubWithdrawalsUSD, totalConvertedTaskEarningsUSD]);

    const netAvailableTaskEarningsUSD = useMemo(() => {
        if (currentUser?.taskEarningsBalance !== undefined && currentUser?.taskEarningsBalance !== null) {
            return Number(currentUser.taskEarningsBalance.toFixed(2));
        }
        const net = totalLifetimeTaskEarningsUSD - totalDeductedHubWithdrawalsUSD - totalConvertedTaskEarningsUSD - fundsUsedForCampaignUSD;
        return Math.max(0, Number(net.toFixed(2)));
    }, [currentUser?.taskEarningsBalance, totalLifetimeTaskEarningsUSD, totalDeductedHubWithdrawalsUSD, totalConvertedTaskEarningsUSD, fundsUsedForCampaignUSD]);

    const approvedTaskRewardsCount = useMemo(() => {
        const standaloneCount = approvedTaskTrxs.filter(t => 
            !approvedTaskSubmissions.some(s => String(s._id) === String(t._id) || (t as any).submissionId === String(s._id))
        ).length;
        return approvedTaskSubmissions.length + standaloneCount;
    }, [approvedTaskSubmissions, approvedTaskTrxs]);

    // Rejected & Pending Submissions breakdown
    const rejectedTaskSubmissions = useMemo(() => {
        return (userTaskSubmissions || []).filter(s => 
            isWorkerSubmission(s) && s.status === 'Rejected'
        );
    }, [userTaskSubmissions, isWorkerSubmission]);

    const pendingTaskSubmissions = useMemo(() => {
        return (userTaskSubmissions || []).filter(s => 
            isWorkerSubmission(s) && (s.status === 'Pending' || s.status === 'In Review' || s.status === 'Submitted')
        );
    }, [userTaskSubmissions, isWorkerSubmission]);

    const pendingTaskRewardsUSD = pendingTaskSubmissions.reduce((sum, s) => sum + (s.rewardAmount || 0), 0);

    // Campaign Finance Calculations matching "My campaign" sub-menu (UserTasksSubmit)
    const mySubmittedTasks = useMemo(() => {
        return (userTasks || []).filter(t => 
            String(t.userId) === String(userIdStr) ||
            t.userEmail === currentUser.email
        );
    }, [userTasks, userIdStr, currentUser.email]);

    const getCampaignFin = (t: any) => {
        const subtotal = Number(((t?.targetQuantity || 1) * (t?.rewardPerTask || 0)).toFixed(2));
        const commissionPercent = state.settings?.userTaskConfig?.commissionPercent ?? 10;
        const adminCommission = Number(t?.adminCommission ?? (subtotal * (commissionPercent / 100)).toFixed(2));
        const slotsAndCommissionBudget = Number(t?.totalBudget ?? (subtotal + adminCommission).toFixed(2));
        const defaultCreationFee = state.settings?.userTaskConfig?.campaignFeeEnabled ? (state.settings?.userTaskConfig?.campaignFeeAmount || 0) : 0;
        const campaignCreationFee = Number((t?.baseFeeCharged ?? t?.campaignFeeUSD ?? t?.baseCampaignFee ?? defaultCreationFee).toFixed(2));
        const grandTotalLaunchCost = Number((slotsAndCommissionBudget + campaignCreationFee).toFixed(2));
        return {
            subtotal,
            adminCommission,
            slotsAndCommissionBudget,
            campaignCreationFee,
            grandTotalLaunchCost
        };
    };

    const campaignPurchasesUSD = useMemo(() => {
        const totalSpent = mySubmittedTasks.reduce((acc, t) => acc + getCampaignFin(t).grandTotalLaunchCost, 0);
        return Number(totalSpent.toFixed(2)) || 0;
    }, [mySubmittedTasks, state.settings]);

    const totalCampaignPurchasesUSD = campaignPurchasesUSD;

    // Deposits and Withdrawals for Work & Earn Hub
    const totalHubDepositsBase = useMemo(() => {
        return (deposits || [])
            .filter(d => d.userId?.toString() === userIdStr && (d.status === 'Approved' || d.status === 'Paid') && ((d as any).isHub || (d as any).isTaskWallet || d.userNotes?.toLowerCase().includes('hub') || d.userNotes?.toLowerCase().includes('task')))
            .reduce((sum, d) => sum + (d.amount || 0), 0);
    }, [deposits, userIdStr]);

    const totalHubDepositsUSD = totalHubDepositsBase / (exchangeRate || 1);

    const totalHubWithdrawalsBase = useMemo(() => {
        return (withdrawals || [])
            .filter(w => w.userId?.toString() === userIdStr && (w.status === 'Approved' || w.status === 'Paid') && ((w as any).isHub || (w as any).isTaskWallet || w.userNotes?.toLowerCase().includes('hub') || w.userNotes?.toLowerCase().includes('task')))
            .reduce((sum, w) => sum + (w.amount || 0), 0);
    }, [withdrawals, userIdStr]);

    const totalHubWithdrawalsUSD = totalHubWithdrawalsBase / (exchangeRate || 1);

    const investmentTransferSumUSD = useMemo(() => {
        if (!userIdStr) return 0;
        const userCurr = currentUser.currency || 'USD';
        const rates = state.settings?.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278, USDT: 1 };
        const userCurrRate = rates[userCurr] || 1;

        return (transactions || []).reduce((sum, trx) => {
            if (trx.userId?.toString() !== userIdStr) return sum;
            if (trx.status === 'Rejected' || trx.status === 'Cancelled') return sum;

            const typeLower = (trx.type || '').toLowerCase();
            const descLower = (trx.description || '').toLowerCase();

            const isInvestmentToTask = 
                typeLower === 'investment to task wallet transfer' ||
                typeLower.includes('investment to task') ||
                (typeLower.includes('transfer') && descLower.includes('investment') && (descLower.includes('task') || descLower.includes('work')));

            if (isInvestmentToTask) {
                const rawAmt = trx.amountUSD && Math.abs(trx.amountUSD) > 0
                    ? Math.abs(trx.amountUSD)
                    : Math.abs((trx.amount || 0) / (trx.exchangeRate || userCurrRate));
                return sum + rawAmt;
            }
            return sum;
        }, 0);
    }, [transactions, userIdStr, currentUser.currency, state.settings]);

    const totalTransferredInUSD = useMemo(() => {
        return Number((investmentTransferSumUSD + fundsUsedForCampaignUSD + totalHubDepositsUSD).toFixed(2));
    }, [investmentTransferSumUSD, fundsUsedForCampaignUSD, totalHubDepositsUSD]);

    const availableTransferBalanceUSD = useMemo(() => {
        return Math.max(0, Number((totalTransferredInUSD - totalCampaignPurchasesUSD).toFixed(2)));
    }, [totalTransferredInUSD, totalCampaignPurchasesUSD]);

    // 2x3 Bento Grid calculations
    const { tasksTodayCount, earnedTodayUSD } = useMemo(() => {
        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        let count = 0;
        let earned = 0;

        (userTaskSubmissions || []).forEach(s => {
            if (isWorkerSubmission(s) && (s.status === 'Approved' || s.status === 'Completed')) {
                const time = new Date(s.updatedAt || s.createdAt || 0).getTime();
                if (time >= twentyFourHoursAgo) {
                    count += 1;
                    earned += (s.rewardAmount || 0);
                }
            }
        });

        return { tasksTodayCount: count, earnedTodayUSD: Number(earned.toFixed(2)) };
    }, [userTaskSubmissions, isWorkerSubmission]);

    const activeCampaignsCount = useMemo(() => {
        return mySubmittedTasks.filter(t => t.status === 'Approved' || t.status === 'Active' || t.status === 'Running').length;
    }, [mySubmittedTasks]);

    const referralIncomeUSD = useMemo(() => {
        if (currentUser.referralEarningsUSD !== undefined && currentUser.referralEarningsUSD !== null) {
            return Number(currentUser.referralEarningsUSD.toFixed(2));
        }
        return (transactions || []).reduce((sum, t) => {
            if (t.userId?.toString() !== userIdStr) return sum;
            if (t.status === 'Rejected' || t.status === 'Cancelled') return sum;
            const typeLower = (t.type || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();
            if (typeLower.includes('referral') || descLower.includes('referral')) {
                const amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs((t.amount || 0) / (exchangeRate || 1));
                return sum + amtUSD;
            }
            return sum;
        }, 0);
    }, [currentUser.referralEarningsUSD, transactions, userIdStr, exchangeRate]);

    // 1. Available Tasks from "Earn Cash & Gig Hub" (userTasks)
    const availableHubTasks = useMemo(() => {
        return userTasks.filter(t => {
            const isApproved = t.status === 'Approved' || t.status === 'Paid';
            const isNotMine = t.userId?.toString() !== currentUser._id?.toString();
            const hasSlots = t.currentCompletions < t.targetQuantity;
            const alreadySubmitted = userTaskSubmissions.some(s => {
                const matchTask = s.taskId?.toString() === t._id?.toString();
                const wId = typeof s.workerId === 'object' ? (s.workerId as any)?._id : s.workerId;
                const uId = typeof (s as any).userId === 'object' ? (s as any).userId?._id : (s as any).userId;
                const matchUser = (wId && wId.toString() === currentUser._id?.toString()) ||
                                  (uId && uId.toString() === currentUser._id?.toString()) ||
                                  (s.workerName && currentUser.username && s.workerName === currentUser.username);
                return matchTask && matchUser;
            });
            return isApproved && isNotMine && hasSlots && !alreadySubmitted;
        });
    }, [userTasks, currentUser._id, currentUser.username, userTaskSubmissions]);

    // 2. My Created Campaigns from "Earn Cash & Gig Hub"
    const myCreatedCampaigns = useMemo(() => {
        return userTasks.filter(t => t.userId?.toString() === currentUser._id?.toString());
    }, [userTasks, currentUser._id]);

    // 3. My Submissions / History from "Earn Cash & Gig Hub"
    const mySubmissions = useMemo(() => {
        return (userTaskSubmissions || []).filter(s => isWorkerSubmission(s));
    }, [userTaskSubmissions, isWorkerSubmission]);

    // Work & Earn Configuration (Admin controllable)
    const workAndEarnConfig = useWorkAndEarnConfig();
    const dashboardAdminConfig = workAndEarnConfig?.submenus?.dashboard;
    const isPurposeHistoryVisible = dashboardAdminConfig?.showPurposeFinancialHistory !== false;
    const purposeHistoryHeadingText = dashboardAdminConfig?.purposeHistoryHeading || 'Financial History by Purpose';
    const purposeHistoryDescriptionText = dashboardAdminConfig?.purposeHistoryDescription || 'Comprehensive audit trail categorized by worker rewards, conversions, campaign fund transfers, and expenditures.';
    const adminDefaultPerPage = dashboardAdminConfig?.purposeHistoryDefaultPerPage || 10;

    // Purpose-Based Transaction & Activity Log state
    const [historyPurposeFilter, setHistoryPurposeFilter] = useState<'all' | 'worker_earnings' | 'conversion_withdrawal' | 'campaign_transfers' | 'campaign_expenditures'>('all');
    const [purposeSearchQuery, setPurposeSearchQuery] = useState<string>('');
    const [purposeTypeFilter, setPurposeTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
    const [purposeHistoryPerPage, setPurposeHistoryPerPage] = useState<number>(adminDefaultPerPage);
    const [purposeHistoryPage, setPurposeHistoryPage] = useState<number>(1);

    // Sync records per page if admin config changes
    useEffect(() => {
        if (adminDefaultPerPage) {
            setPurposeHistoryPerPage(adminDefaultPerPage);
        }
    }, [adminDefaultPerPage]);

    const purposeHistoryLogs = useMemo(() => {
        const items: Array<{
            id: string;
            date: string;
            purpose: 'worker_earnings' | 'conversion_withdrawal' | 'campaign_transfers' | 'campaign_expenditures';
            purposeLabel: string;
            title: string;
            description: string;
            amountUSD: number;
            type: 'credit' | 'debit';
            status: string;
        }> = [];

        // 1. Worker Earnings: Approved Task Submissions
        approvedTaskSubmissions.forEach(s => {
            items.push({
                id: 'sub_' + s._id,
                date: s.updatedAt || s.createdAt || new Date().toISOString(),
                purpose: 'worker_earnings',
                purposeLabel: 'Worker Task Reward',
                title: s.taskTitle || 'Completed Job',
                description: `Reward earned as Worker for completing task: ${s.taskTitle || 'Micro-Task'}`,
                amountUSD: s.rewardAmount || 0,
                type: 'credit',
                status: s.status || 'Approved'
            });
        });

        // 2. Standalone Task Reward Transactions
        approvedTaskTrxs.forEach(t => {
            const isDup = approvedTaskSubmissions.some(s => String(s._id) === String(t._id) || (t as any).submissionId === String(s._id));
            if (!isDup) {
                let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
                if (t.currency && t.currency !== 'USD') {
                    amtUSD = amtUSD / (t.exchangeRate || exchangeRate || 1);
                }
                items.push({
                    id: 'trx_' + t._id,
                    date: t.date || new Date().toISOString(),
                    purpose: 'worker_earnings',
                    purposeLabel: 'Worker Task Reward',
                    title: t.description?.substring(0, 40) || 'Task Reward',
                    description: t.description || 'Task Reward Credited',
                    amountUSD: amtUSD,
                    type: 'credit',
                    status: t.status || 'Approved'
                });
            }
        });

        // 3. Withdrawals
        userHubWithdrawals.forEach(w => {
            const amtUSD = w.currency && w.currency !== 'USD' ? (w.amount / (exchangeRate || 1)) : w.amount;
            items.push({
                id: 'wdr_' + w._id,
                date: w.createdAt || new Date().toISOString(),
                purpose: 'conversion_withdrawal',
                purposeLabel: 'Withdrawal Request',
                title: `Withdrawal via ${w.paymentMethod || 'Wallet'}`,
                description: `Payout withdrawal request (${w.paymentMethod || 'Hub Wallet'})`,
                amountUSD: amtUSD,
                type: 'debit',
                status: w.status
            });
        });

        // 4. Conversions & Transfers from Transactions
        (transactions || []).forEach(t => {
            if (t.userId?.toString() !== userIdStr) return;
            if (t.status === 'Rejected' || t.status === 'Cancelled') return;

            const typeLower = (t.type || '').toLowerCase();
            const descLower = (t.description || '').toLowerCase();

            const isInvestmentTransfer = 
                typeLower.includes('investment to task') ||
                typeLower.includes('investment to campaign') ||
                typeLower.includes('investment wallet') ||
                descLower.includes('from investment wallet') ||
                descLower.includes('from investment module') ||
                descLower.includes('investment to task') ||
                descLower.includes('investment to campaign') ||
                descLower.includes('investment wallet to task wallet');

            const isCampaignTransfer = 
                !isInvestmentTransfer && (
                    typeLower.includes('task reward transfer') ||
                    (typeLower.includes('campaign') && (typeLower.includes('task') || descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('campaign') && (descLower.includes('task earnings') || descLower.includes('task wallet') || descLower.includes('converted') || descLower.includes('transferred')))
                );

            const isGeneralConversion = 
                !isInvestmentTransfer && !isCampaignTransfer && (
                    typeLower.includes('task wallet conversion') ||
                    typeLower.includes('task wallet transfer') ||
                    typeLower.includes('task earnings conversion') ||
                    typeLower.includes('task earnings transfer') ||
                    (descLower.includes('converted') && (descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('transferred') && (descLower.includes('task earnings') || descLower.includes('task wallet')))
                );

            let amtUSD = t.amountUSD && Math.abs(t.amountUSD) > 0 ? Math.abs(t.amountUSD) : Math.abs(t.amount || 0);
            if (t.currency && t.currency !== 'USD') {
                amtUSD = amtUSD / (t.exchangeRate || exchangeRate || 1);
            }

            if (isInvestmentTransfer) {
                items.push({
                    id: 'trx_inv_' + t._id,
                    date: t.date || new Date().toISOString(),
                    purpose: 'campaign_transfers',
                    purposeLabel: 'Campaign Fund Transfer (Investment)',
                    title: 'Investment Wallet → Campaign Fund',
                    description: t.description || 'Investment Module funds transferred to Campaign Wallet',
                    amountUSD: amtUSD,
                    type: 'debit',
                    status: t.status || 'Approved'
                });
            } else if (isCampaignTransfer) {
                items.push({
                    id: 'trx_cmp_' + t._id,
                    date: t.date || new Date().toISOString(),
                    purpose: 'campaign_transfers',
                    purposeLabel: 'Campaign Fund Transfer (Task Earnings)',
                    title: 'Task Earnings Wallet → Campaign Fund',
                    description: t.description || 'Task Earnings converted/transferred to Campaign Wallet',
                    amountUSD: amtUSD,
                    type: 'debit',
                    status: t.status || 'Approved'
                });
            } else if (isGeneralConversion) {
                items.push({
                    id: 'trx_conv_' + t._id,
                    date: t.date || new Date().toISOString(),
                    purpose: 'conversion_withdrawal',
                    purposeLabel: 'Task Wallet Conversion',
                    title: 'Task Earnings Conversion',
                    description: t.description || 'Converted Task Earnings to Registered Base Currency',
                    amountUSD: amtUSD,
                    type: 'debit',
                    status: t.status || 'Approved'
                });
            }
        });

        // 5. Campaign Expenditures & Launch Fees
        mySubmittedTasks.forEach(cmp => {
            const fin = getCampaignFin(cmp);
            items.push({
                id: 'cmp_exp_' + cmp._id,
                date: cmp.createdAt || new Date().toISOString(),
                purpose: 'campaign_expenditures',
                purposeLabel: 'Campaign Expenditure',
                title: `Campaign: ${cmp.title}`,
                description: `Campaign budget & creation fee (${cmp.targetQuantity} slots @ $${cmp.rewardPerTask} USD)`,
                amountUSD: fin.grandTotalLaunchCost,
                type: 'debit',
                status: cmp.status || 'Active'
            });
        });

        // Sort by date descending
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [approvedTaskSubmissions, approvedTaskTrxs, userHubWithdrawals, transactions, mySubmittedTasks, userIdStr, exchangeRate]);

    const filteredPurposeLogs = useMemo(() => {
        return purposeHistoryLogs.filter(item => {
            // Category / Purpose Filter
            if (historyPurposeFilter !== 'all' && item.purpose !== historyPurposeFilter) {
                return false;
            }
            // Credit / Debit Type Filter
            if (purposeTypeFilter !== 'all' && item.type !== purposeTypeFilter) {
                return false;
            }
            // Keyword Search Filter
            if (purposeSearchQuery.trim()) {
                const q = purposeSearchQuery.trim().toLowerCase();
                const match = 
                    (item.title && item.title.toLowerCase().includes(q)) ||
                    (item.description && item.description.toLowerCase().includes(q)) ||
                    (item.purposeLabel && item.purposeLabel.toLowerCase().includes(q)) ||
                    (item.id && item.id.toLowerCase().includes(q)) ||
                    (item.status && item.status.toLowerCase().includes(q)) ||
                    item.amountUSD.toFixed(2).includes(q);
                if (!match) return false;
            }
            return true;
        });
    }, [purposeHistoryLogs, historyPurposeFilter, purposeTypeFilter, purposeSearchQuery]);

    // Reset current page when filters or per-page limit change
    useEffect(() => {
        setPurposeHistoryPage(1);
    }, [historyPurposeFilter, purposeTypeFilter, purposeSearchQuery, purposeHistoryPerPage]);

    const totalPurposePages = Math.max(1, Math.ceil(filteredPurposeLogs.length / purposeHistoryPerPage));

    // Ensure valid page range
    useEffect(() => {
        if (purposeHistoryPage > totalPurposePages) {
            setPurposeHistoryPage(1);
        }
    }, [totalPurposePages, purposeHistoryPage]);

    const paginatedPurposeLogs = useMemo(() => {
        const start = (purposeHistoryPage - 1) * purposeHistoryPerPage;
        return filteredPurposeLogs.slice(start, start + purposeHistoryPerPage);
    }, [filteredPurposeLogs, purposeHistoryPage, purposeHistoryPerPage]);

    // Handle Direct Post Campaign Click (Requirement 2.1)
    const handlePostNewCampaignDirect = () => {
        navigate('/member/user-tasks?tab=submit');
    };

    // Toggle Campaign Status (Pause / Resume)
    const handleToggleCampaign = async (task: UserTask) => {
        const isOwner = task.userId?.toString() === currentUser._id?.toString();
        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
        if (!isOwner && !isAdmin) {
            alert("You are not authorized to modify this campaign.");
            return;
        }

        const isCurrentlyActive = task.status === 'Approved';
        const isCurrentlyPaused = task.status === 'On Hold';

        if (isCurrentlyPaused) {
            if (!window.confirm("Are you sure you want to resume this campaign?")) return;
        } else if (isCurrentlyActive) {
            if (!window.confirm("Are you sure you want to pause this campaign?")) return;
        } else {
            alert("Unable to pause campaign.");
            return;
        }

        const nextStatus = isCurrentlyActive ? 'On Hold' : 'Approved';
        try {
            const res = await updateUserTaskStatus(task._id, { status: nextStatus });
            const finalTask = res?.data?.task || res?.data || res?.task || (res?._id ? res : task);
            dispatch({ type: 'UPDATE_USER_TASK', payload: finalTask });
            const msg = isCurrentlyActive ? "Campaign paused successfully." : "Campaign resumed successfully.";
            setSuccessMessage(msg);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Delete Campaign
    const handleDeleteCampaignItem = async (taskId: string) => {
        if (!window.confirm("Are you sure you want to delete this campaign? Any remaining slots budget will be refunded to your balance.")) return;
        try {
            await deleteUserTask(taskId);
            dispatch({ type: 'DELETE_USER_TASK', payload: taskId });
            setSuccessMessage("Campaign deleted and remaining budget refunded successfully!");
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (error) {
            alert(`Failed to delete campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Handle Proof Submission for Hub UserTask
    const handleTaskProofImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setTaskProofImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmitUserTaskProof = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proofTask) return;

        if (proofTask.requireTextProof && !taskProofText.trim()) {
            return alert("Please enter the required text proof.");
        }
        if (proofTask.requireUsername && !taskProofUsername.trim()) {
            return alert("Please enter your username proof.");
        }
        if (proofTask.requireScreenshot && !taskProofImage) {
            return alert("Please upload a screenshot proof.");
        }

        setIsSubmittingTaskProof(true);
        try {
            const res = await submitUserTaskProof(proofTask._id, {
                userId: currentUser._id,
                proofText: taskProofText,
                proofUsername: taskProofUsername,
                proofUserIdVal: taskProofUserIdVal,
                proofEmail: taskProofEmail,
                proofImage: taskProofImage
            });
            dispatch({ type: 'ADD_USER_TASK_SUBMISSION', payload: res.submission || res });
            setProofTask(null);
            setTaskProofText('');
            setTaskProofUsername('');
            setTaskProofUserIdVal('');
            setTaskProofEmail('');
            setTaskProofImage('');
            setSuccessMessage("🎉 Task proof submitted successfully! The creator will review and credit your reward.");
            setTimeout(() => setSuccessMessage(null), 6000);
        } catch (error) {
            alert(`Failed to submit task proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingTaskProof(false);
        }
    };

    // Raise Dispute
    const handleRaiseDisputeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!disputeSubmission || !disputeDescription.trim()) {
            return alert("Please describe your dispute clearly.");
        }
        setIsSubmittingDispute(true);
        try {
            const updated = await openTaskDispute(disputeSubmission._id, {
                disputeReason: disputeDescription,
                disputeProofImage
            });
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
            setDisputeSubmission(null);
            setDisputeDescription('');
            setDisputeProofImage('');
            setSuccessMessage("Dispute submitted successfully! The campaign creator has been notified.");
            setTimeout(() => setSuccessMessage(null), 6000);
        } catch (error) {
            alert(`Failed to raise dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    // Conversions
    const handleConvertAll = async () => {
        if (!currentUser.taskWalletBalance || currentUser.taskWalletBalance <= 0) {
            alert('Your Task Wallet is currently empty. Complete available jobs or tasks to earn USD!');
            return;
        }

        const confirmMsg = `Convert your full Task Wallet balance of $${currentUser.taskWalletBalance.toFixed(2)} USD?\nThis will convert $${currentUser.taskWalletBalance.toFixed(2)} USD into ${(currentUser.taskWalletBalance * exchangeRate).toFixed(2)} ${currentUser.currency} (your registered base currency) for withdrawal.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const data = await convertTaskWalletBalance({ userId: currentUser._id });
            dispatch({ type: 'UPDATE_USER', payload: data.user });
            dispatch({
                type: 'ADD_TRANSACTION',
                payload: {
                    _id: 'trx_conv_' + Date.now(),
                    userId: currentUser._id,
                    type: 'Task Wallet Conversion',
                    amount: data.convertedTaskBalance || currentUser.taskWalletBalance || 0,
                    currency: data.currency || currentUser.currency,
                    exchangeRate: exchangeRate,
                    description: `Converted $${(data.convertedTaskBalance || currentUser.taskWalletBalance || 0).toFixed(2)} USD Task Wallet balance to ${(data.convertedAmount || 0).toFixed(2)} ${currentUser.currency}`,
                    status: 'Approved',
                    date: new Date().toISOString()
                }
            });
            setSuccessMessage(`🎉 Converted $${(data.convertedTaskBalance || 0).toFixed(2)} USD! ${data.convertedAmount.toFixed(2)} ${data.currency} is now available in your registered base currency (${data.currency}) for withdrawal.`);
            setTimeout(() => setSuccessMessage(null), 6000);
        } catch (err) {
            alert(`Conversion error: ${err instanceof Error ? err.message : 'Failed to convert'}`);
        }
    };

    const handleConvertAmount = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(convertAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid amount.');
            return;
        }
        if ((currentUser.taskWalletBalance || 0) < amt) {
            alert(`Insufficient Task Wallet balance. Available: $${(currentUser.taskWalletBalance || 0).toFixed(2)} USD.`);
            return;
        }

        setIsConverting(true);
        try {
            const data = await convertUserCurrency({
                userId: currentUser._id,
                amount: amt,
                fromCurrency: 'USD',
                toCurrency: currentUser.currency
            });
            dispatch({ type: 'UPDATE_USER', payload: data.user });
            dispatch({
                type: 'ADD_TRANSACTION',
                payload: {
                    _id: 'trx_conv_' + Date.now(),
                    userId: currentUser._id,
                    type: 'Task Wallet Conversion',
                    amount: amt,
                    currency: currentUser.currency,
                    exchangeRate: exchangeRate,
                    description: `Converted $${amt.toFixed(2)} USD Task Wallet balance to ${(data.convertedAmount || amt * exchangeRate).toFixed(2)} ${currentUser.currency}`,
                    status: 'Approved',
                    date: new Date().toISOString()
                }
            });
            setIsConvertModalOpen(false);
            setConvertAmount('');
            setSuccessMessage(`✅ Converted $${amt.toFixed(2)} USD to ${data.convertedAmount.toFixed(2)} ${currentUser.currency}!`);
            setTimeout(() => setSuccessMessage(null), 6000);
        } catch (err) {
            alert(`Conversion error: ${err instanceof Error ? err.message : 'Failed to convert'}`);
        } finally {
            setIsConverting(false);
        }
    };

    // Offerwall Gig Completion Handler
    const handleSubmitGigProof = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGig) return;

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

    // Filter Offerwall Gigs according to Tab and Search
    const filteredOfferwallGigs = useMemo(() => {
        return DEFAULT_GIGS.filter(gig => {
            if (dashboardTab === 'other_tasks') {
                if (activeSubTab) {
                    const matchSub = gig.subTabKey === activeSubTab || 
                                     gig.providerKey.toLowerCase() === activeSubTab.toLowerCase() ||
                                     gig.provider.toLowerCase().includes(activeSubTab.toLowerCase());
                    if (!matchSub) return false;
                }
            } else if (dashboardTab === 'available_jobs') {
                if (gig.category !== 'Available Jobs') return false;
            } else {
                return false;
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
    }, [dashboardTab, activeSubTab, searchQuery, difficultyFilter]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12 px-3 sm:px-6 pt-2">
            
            {/* Top Success Toast Notice */}
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

            {/* Captivating Header Card & Referral Link */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl border border-slate-800/80">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
                    {/* User Info Block */}
                    <div className="flex items-center gap-3 sm:gap-5">
                        <div className="relative shrink-0">
                            <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-indigo-600 p-0.5 sm:p-1 shadow-lg">
                                <div className="w-full h-full bg-slate-900 rounded-[10px] sm:rounded-[12px] flex items-center justify-center text-sm sm:text-xl font-black text-white uppercase">
                                    {currentUser.fullName ? currentUser.fullName.substring(0, 2) : currentUser.username.substring(0, 2)}
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-0.5 sm:p-1 rounded-full text-slate-950 shadow-md">
                                <ZapIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                            </div>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <h1 className="text-base sm:text-xl font-black tracking-tight text-white truncate">
                                    {currentUser.fullName || currentUser.username}
                                </h1>
                                <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                                    <SparklesIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Smart Pro Earner
                                </span>
                            </div>

                            <p className="text-slate-400 text-[11px] sm:text-xs font-mono flex items-center gap-1.5 truncate">
                                <UserIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
                                <span>@{currentUser.username}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-emerald-400 font-semibold">{currentUser.country}</span>
                            </p>
                        </div>
                    </div>

                    {/* Referral Code Quick Share */}
                    <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800 w-full md:w-auto flex items-center justify-between gap-2.5 sm:gap-3">
                        <div className="text-left min-w-0">
                            <span className="text-[8px] sm:text-[9px] font-bold uppercase text-slate-400 tracking-wider block truncate">Your Invite Link</span>
                            <span className="text-xs font-mono font-bold text-amber-300 truncate block">{currentUser.referralCode || currentUser.username}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={handleCopyReferral}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center gap-1 min-h-[36px] sm:min-h-[44px]"
                            >
                                <CopyIcon className="w-3.5 h-3.5 text-amber-400" />
                                <span>{copiedReferral ? 'Copied!' : 'Copy'}</span>
                            </button>
                            <button
                                onClick={handleShareReferral}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center gap-1 min-h-[36px] sm:min-h-[44px]"
                            >
                                <ShareIcon className="w-3.5 h-3.5" />
                                <span>Share</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* B. Gradient Hero Balance Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 border border-indigo-500/40 shadow-2xl space-y-3 sm:space-y-5">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-300">
                                Available Earnings
                            </span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
                            <span className="text-xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight">
                                ${netAvailableTaskEarningsUSD.toFixed(2)} <span className="text-xs sm:text-sm font-bold text-amber-400">USD</span>
                            </span>
                            {currentUser.currency !== 'USD' && (
                                <span className="text-xs sm:text-base font-bold text-slate-300 font-mono">
                                    ({getCurrencySymbol()}{(netAvailableTaskEarningsUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium pt-0.5">
                            Ready to withdraw to your bank, crypto wallet, or e-wallet
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                            Ready for Cashout
                        </span>
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                            Auto Converted
                        </span>
                    </div>
                </div>

                {/* Sub-Card Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2 relative z-10">
                    {/* Task Earnings Wallet */}
                    <div className="bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-500/30 space-y-1.5 sm:space-y-2 hover:border-amber-500/60 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 sm:gap-1.5">
                                <WalletIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> Task Earnings
                            </span>
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <span className="text-[8px] sm:text-[9px] bg-amber-400/20 text-amber-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase">Work Income</span>
                                <button
                                    onClick={() => setShowTaskEarningsBreakdown(!showTaskEarningsBreakdown)}
                                    className="text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 p-0.5 sm:p-1 rounded-lg transition-all flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold min-h-[24px] sm:min-h-[28px] px-1.5 sm:px-2"
                                    title="Toggle Breakdown Details"
                                >
                                    <span>Breakdown</span>
                                    {showTaskEarningsBreakdown ? <ChevronUpIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ChevronDownIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 sm:gap-2 pt-0.5">
                            <span className="text-base sm:text-xl font-bold text-white font-mono">
                                ${netAvailableTaskEarningsUSD.toFixed(2)} <span className="text-[10px] sm:text-xs text-amber-400 font-bold">USD</span>
                            </span>
                            {currentUser.currency !== 'USD' && (
                                <span className="text-[11px] sm:text-xs font-bold text-slate-400 font-mono">
                                    ({getCurrencySymbol()}{(netAvailableTaskEarningsUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">
                            Accumulated earnings from completed gigs & micro-tasks.
                        </p>

                        {/* Dropdown Breakdown for Task Earnings */}
                        {showTaskEarningsBreakdown && (
                            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-800 space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs text-slate-300">
                                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800/80 flex items-center justify-between">
                                    <span>Task Earnings Calculation</span>
                                    <span className="text-slate-400">Worker Wallet</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Lifetime Task Rewards:</span>
                                    <span className="font-bold text-emerald-400 font-mono">${totalLifetimeTaskEarningsUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Conversions / Cashout:</span>
                                    <span className="font-bold text-indigo-400 font-mono">-${fundConversionOrWithdrawalUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Used for Campaign Wallet:</span>
                                    <span className="font-bold text-purple-400 font-mono">-${fundsUsedForCampaignUSD.toFixed(2)} USD</span>
                                </div>
                                {pendingHubWithdrawalsUSD > 0 && (
                                    <div className="flex justify-between items-center text-amber-300">
                                        <span className="text-amber-400/90">Pending Cashout Review:</span>
                                        <span className="font-bold text-amber-300 font-mono">-${pendingHubWithdrawalsUSD.toFixed(2)} USD</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
                                    <span className="text-slate-200">Withdrawable Balance:</span>
                                    <span className="text-amber-300 font-mono">${netAvailableTaskEarningsUSD.toFixed(2)} USD</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Campaign Wallet */}
                    <div className="bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/30 space-y-1.5 sm:space-y-2 hover:border-blue-500/60 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1 sm:gap-1.5">
                                <ConvertIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> Campaign Wallet
                            </span>
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <span className="text-[8px] sm:text-[9px] bg-blue-500/20 text-blue-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase">Promotions</span>
                                <button
                                    onClick={() => setShowCampaignWalletBreakdown(!showCampaignWalletBreakdown)}
                                    className="text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 p-0.5 sm:p-1 rounded-lg transition-all flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold min-h-[24px] sm:min-h-[28px] px-1.5 sm:px-2"
                                    title="Toggle Breakdown Details"
                                >
                                    <span>Breakdown</span>
                                    {showCampaignWalletBreakdown ? <ChevronUpIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ChevronDownIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 sm:gap-2 pt-0.5">
                            <span className="text-base sm:text-xl font-bold text-blue-300 font-mono">
                                ${availableTransferBalanceUSD.toFixed(2)} <span className="text-[10px] sm:text-xs text-blue-400 font-bold">USD</span>
                            </span>
                            {currentUser.currency !== 'USD' && (
                                <span className="text-[11px] sm:text-xs font-bold text-slate-400 font-mono">
                                    ({getCurrencySymbol()}{(availableTransferBalanceUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">
                            Funds reserved for launching YouTube & Social media promotions.
                        </p>

                        {/* Dropdown Breakdown for Campaign Wallet */}
                        {showCampaignWalletBreakdown && (
                            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-800 space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs text-slate-300">
                                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-400 pb-1 border-b border-slate-800/80 flex items-center justify-between">
                                    <span>Campaign Wallet Calculation</span>
                                    <span className="text-slate-400">Advertiser Wallet</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Deposits / Investments In:</span>
                                    <span className="font-bold text-blue-300 font-mono">${(investmentTransferSumUSD + totalHubDepositsUSD).toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">From Task Earnings:</span>
                                    <span className="font-bold text-purple-300 font-mono">${fundsUsedForCampaignUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-800/60 pt-1">
                                    <span className="text-slate-300 font-bold">Total Funding:</span>
                                    <span className="font-bold text-emerald-400 font-mono">${totalTransferredInUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Campaign Budget Spent:</span>
                                    <span className="font-bold text-amber-400 font-mono">-${totalCampaignPurchasesUSD.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
                                    <span className="text-slate-200">Available Campaign Balance:</span>
                                    <span className="text-blue-300 font-mono">${availableTransferBalanceUSD.toFixed(2)} USD</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* C. Quick Action Row */}
            <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-xl space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 sm:gap-1.5">
                        <ZapIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> Quick Actions
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Instant Shortcuts</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                    {/* 1. Tasks */}
                    <button
                        onClick={() => navigate('/member/available-tasks')}
                        className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700 hover:border-amber-500/50 transition-all flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 group min-h-[48px] sm:min-h-[52px]"
                    >
                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                            <TaskIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight truncate w-full">Tasks</span>
                        <span className="text-[9px] text-slate-400 hidden lg:inline">Browse & do jobs</span>
                    </button>

                    {/* 2. Campaign */}
                    <button
                        onClick={() => navigate('/member/create-campaign')}
                        className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 group min-h-[48px] sm:min-h-[52px]"
                    >
                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                            <MegaphoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight truncate w-full">Campaign</span>
                        <span className="text-[9px] text-slate-400 hidden lg:inline">Create promotion</span>
                    </button>

                    {/* 3. Withdraw */}
                    <button
                        onClick={() => navigate('/member/withdraw')}
                        className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700 hover:border-teal-500/50 transition-all flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 group min-h-[48px] sm:min-h-[52px]"
                    >
                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                            <WithdrawalIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight truncate w-full">Withdraw</span>
                        <span className="text-[9px] text-slate-400 hidden lg:inline">Cashout funds</span>
                    </button>

                    {/* 4. Deposit */}
                    <button
                        onClick={() => navigate('/member/deposit')}
                        className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700 hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 group min-h-[48px] sm:min-h-[52px]"
                    >
                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            <DepositIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight truncate w-full">Deposit</span>
                        <span className="text-[9px] text-slate-400 hidden lg:inline">Add campaign funds</span>
                    </button>

                    {/* 5. Convert / Transfer */}
                    <button
                        onClick={() => setIsConvertModalOpen(true)}
                        className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center text-center gap-1 sm:gap-1.5 group min-h-[48px] sm:min-h-[52px]"
                    >
                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                            <ConvertIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight truncate w-full">Transfer</span>
                        <span className="text-[9px] text-slate-400 hidden lg:inline">To campaign wallet</span>
                    </button>
                </div>
            </div>

            {/* D. Bento Performance Summary */}
            <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-400"></span>
                        <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300">
                            Activity Overview
                        </h3>
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Updated Live</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
                    {/* Card 1: Tasks Today */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-amber-300">
                                <TaskIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" /> Tasks Today
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-amber-500/20 text-amber-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">24h</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-white font-mono pt-0.5 sm:pt-1">
                            {tasksTodayCount} <span className="text-[10px] sm:text-xs font-normal text-slate-400">Done</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Tasks completed in last 24h</p>
                    </div>

                    {/* Card 2: Earned Today */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1.5 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-emerald-300">
                                <DollarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" /> Earned Today
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-emerald-500/20 text-emerald-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Income</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-emerald-300 font-mono pt-0.5 sm:pt-1">
                            ${earnedTodayUSD.toFixed(2)} <span className="text-[10px] sm:text-xs font-bold text-emerald-400 font-mono">USD</span>
                        </div>
                        {currentUser.currency !== 'USD' && (
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">
                                ({getCurrencySymbol()}{(earnedTodayUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                            </p>
                        )}
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Income earned today</p>
                    </div>

                    {/* Card 3: Pending Review */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-purple-300">
                                <ClockIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400 shrink-0" /> In Review
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-purple-500/20 text-purple-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Pending</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-purple-300 font-mono pt-0.5 sm:pt-1 truncate">
                            {pendingTaskSubmissions.length} <span className="text-[10px] sm:text-xs font-normal text-slate-400">(${pendingTaskRewardsUSD.toFixed(2)})</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Submissions awaiting approval</p>
                    </div>

                    {/* Card 4: Referral Income */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-blue-300">
                                <UsersIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" /> Referral Bonus
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-blue-500/20 text-blue-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Invites</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-blue-300 font-mono pt-0.5 sm:pt-1">
                            ${referralIncomeUSD.toFixed(2)} <span className="text-[10px] sm:text-xs font-bold text-blue-400 font-mono">USD</span>
                        </div>
                        {currentUser.currency !== 'USD' && (
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">
                                ({getCurrencySymbol()}{(referralIncomeUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                            </p>
                        )}
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Earned from referral signups</p>
                    </div>

                    {/* Card 5: Active Campaigns */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-teal-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-teal-300">
                                <MegaphoneIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-400 shrink-0" /> Campaigns
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-teal-500/20 text-teal-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Running</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-teal-300 font-mono pt-0.5 sm:pt-1">
                            {activeCampaignsCount} <span className="text-[10px] sm:text-xs font-normal text-slate-400">Live</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Your running campaigns</p>
                    </div>

                    {/* Card 6: Lifetime Task Earnings */}
                    <div className="bg-slate-900/90 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-1 sm:space-y-1.5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <span className="truncate flex items-center gap-1 sm:gap-1.5 text-amber-300">
                                <RewardIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" /> Total Earned
                            </span>
                            <span className="text-[7px] sm:text-[8px] bg-amber-500/20 text-amber-300 px-1 sm:px-1.5 py-0.5 rounded font-bold uppercase shrink-0">All Time</span>
                        </div>
                        <div className="text-base sm:text-2xl font-bold text-white font-mono pt-0.5 sm:pt-1">
                            ${totalLifetimeTaskEarningsUSD.toFixed(2)} <span className="text-[10px] sm:text-xs font-bold text-amber-400 font-mono">USD</span>
                        </div>
                        {currentUser.currency !== 'USD' && (
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">
                                ({getCurrencySymbol()}{(totalLifetimeTaskEarningsUSD * exchangeRate).toFixed(2)} {currentUser.currency})
                            </p>
                        )}
                        <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Total completed gig rewards</p>
                    </div>
                </div>
            </div>

            {/* E. Fixed Bottom Navigation Bar for Mobile */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-2 py-2 flex items-center justify-around text-slate-300 shadow-2xl">
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold hover:text-amber-400 min-h-[44px] min-w-[44px] justify-center"
                >
                    <HomeIcon className="w-5 h-5 text-amber-400" />
                    <span>Home</span>
                </button>
                <button
                    onClick={() => navigate('/member/available-tasks')}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold hover:text-emerald-400 min-h-[44px] min-w-[44px] justify-center"
                >
                    <TaskIcon className="w-5 h-5 text-emerald-400" />
                    <span>Tasks</span>
                </button>
                <button
                    onClick={() => navigate('/member/create-campaign')}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold hover:text-blue-400 min-h-[44px] min-w-[44px] justify-center"
                >
                    <MegaphoneIcon className="w-5 h-5 text-blue-400" />
                    <span>Campaign</span>
                </button>
                <button
                    onClick={() => navigate('/member/withdraw')}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold hover:text-teal-400 min-h-[44px] min-w-[44px] justify-center"
                >
                    <WithdrawalIcon className="w-5 h-5 text-teal-400" />
                    <span>Withdraw</span>
                </button>
                <button
                    onClick={() => navigate('/member/profile')}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold hover:text-indigo-400 min-h-[44px] min-w-[44px] justify-center"
                >
                    <UserIcon className="w-5 h-5 text-indigo-400" />
                    <span>Profile</span>
                </button>
            </div>

            {/* Purpose-Based Financial History Section (Admin Configurable) */}
            {isPurposeHistoryVisible && (
                <div id="financial-history-purpose-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-xl space-y-3 sm:space-y-4">
                    {/* Header & Record Summary */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3 sm:pb-4">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                                <HistoryIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 truncate">
                                    {purposeHistoryHeadingText}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-2 sm:line-clamp-none">
                                    {purposeHistoryDescriptionText}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 bg-slate-800/90 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-slate-700">
                                {filteredPurposeLogs.length} Records {filteredPurposeLogs.length !== purposeHistoryLogs.length ? `(of ${purposeHistoryLogs.length})` : ''}
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl font-mono">
                                Page {purposeHistoryPage}/{totalPurposePages}
                            </span>
                        </div>
                    </div>

                    {/* Filter Toolbar: Search, Type Filter & Records Per Page */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                        {/* Search Query Input */}
                        <div className="sm:col-span-6 lg:col-span-5 relative">
                            <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                id="purpose-history-search-input"
                                type="text"
                                value={purposeSearchQuery}
                                onChange={(e) => setPurposeSearchQuery(e.target.value)}
                                placeholder="Search records by title, ID, amount, status..."
                                className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] sm:text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                            {purposeSearchQuery && (
                                <button
                                    onClick={() => setPurposeSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-md"
                                    title="Clear search"
                                >
                                    <CloseIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Transaction Type Filter */}
                        <div className="sm:col-span-3 lg:col-span-4 flex items-center gap-1 bg-slate-950/80 p-0.5 sm:p-1 rounded-xl border border-slate-800">
                            <button
                                onClick={() => setPurposeTypeFilter('all')}
                                className={`flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all ${
                                    purposeTypeFilter === 'all'
                                        ? 'bg-slate-800 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setPurposeTypeFilter('credit')}
                                className={`flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all ${
                                    purposeTypeFilter === 'credit'
                                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                        : 'text-slate-400 hover:text-emerald-400'
                                }`}
                            >
                                + Credit
                            </button>
                            <button
                                onClick={() => setPurposeTypeFilter('debit')}
                                className={`flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all ${
                                    purposeTypeFilter === 'debit'
                                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm'
                                        : 'text-slate-400 hover:text-amber-400'
                                }`}
                            >
                                - Debit
                            </button>
                        </div>

                        {/* Records Per Page Dropdown (10, 15, 20, 25, 30, 50) */}
                        <div className="sm:col-span-3 lg:col-span-3 flex items-center justify-between sm:justify-end gap-2 bg-slate-950/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-800">
                            <label htmlFor="purpose-records-per-page-select" className="text-[10px] sm:text-[11px] font-bold text-slate-400 whitespace-nowrap">
                                Per Page:
                            </label>
                            <select
                                id="purpose-records-per-page-select"
                                value={purposeHistoryPerPage}
                                onChange={(e) => setPurposeHistoryPerPage(Number(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold rounded-lg px-2 py-0.5 sm:py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={25}>25</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>

                    {/* Purpose Category Filter Pills */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            id="purpose-filter-btn-all"
                            onClick={() => setHistoryPurposeFilter('all')}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${
                                historyPurposeFilter === 'all'
                                    ? 'bg-slate-700 text-white shadow-md'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <GlobeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>All Activities</span>
                            <span className="text-[9px] sm:text-[10px] bg-slate-900/60 text-slate-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                                {purposeHistoryLogs.length}
                            </span>
                        </button>

                        <button
                            id="purpose-filter-btn-worker"
                            onClick={() => setHistoryPurposeFilter('worker_earnings')}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${
                                historyPurposeFilter === 'worker_earnings'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <RewardIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                            <span>Task Earnings</span>
                            <span className="text-[9px] sm:text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                                {purposeHistoryLogs.filter(p => p.purpose === 'worker_earnings').length}
                            </span>
                        </button>

                        <button
                            id="purpose-filter-btn-conversion"
                            onClick={() => setHistoryPurposeFilter('conversion_withdrawal')}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${
                                historyPurposeFilter === 'conversion_withdrawal'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <ConvertIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                            <span>Conversions / Cashout</span>
                            <span className="text-[9px] sm:text-[10px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                                {purposeHistoryLogs.filter(p => p.purpose === 'conversion_withdrawal').length}
                            </span>
                        </button>

                        <button
                            id="purpose-filter-btn-transfers"
                            onClick={() => setHistoryPurposeFilter('campaign_transfers')}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${
                                historyPurposeFilter === 'campaign_transfers'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <CampaignIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                            <span>Funds Added</span>
                            <span className="text-[9px] sm:text-[10px] bg-cyan-950/80 text-cyan-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                                {purposeHistoryLogs.filter(p => p.purpose === 'campaign_transfers').length}
                            </span>
                        </button>

                        <button
                            id="purpose-filter-btn-expenditures"
                            onClick={() => setHistoryPurposeFilter('campaign_expenditures')}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${
                                historyPurposeFilter === 'campaign_expenditures'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <DollarIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>Campaign Costs</span>
                            <span className="text-[9px] sm:text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                                {purposeHistoryLogs.filter(p => p.purpose === 'campaign_expenditures').length}
                            </span>
                        </button>
                    </div>

                    {/* Mobile High-Density Cards View (Compact for Low-Resolution Screens) */}
                    <div className="block sm:hidden space-y-2">
                        {paginatedPurposeLogs.length > 0 ? (
                            paginatedPurposeLogs.map((log) => {
                                const isCredit = log.type === 'credit';
                                return (
                                    <div 
                                        key={`mob-${log.id}`} 
                                        className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/90 space-y-1.5 hover:border-slate-700 transition-all shadow-sm"
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1.5">
                                                {log.purpose === 'worker_earnings' && (
                                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                        Task Reward
                                                    </span>
                                                )}
                                                {log.purpose === 'conversion_withdrawal' && (
                                                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                        Cashout/Conv
                                                    </span>
                                                )}
                                                {log.purpose === 'campaign_transfers' && (
                                                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                        Funds In
                                                    </span>
                                                )}
                                                {log.purpose === 'campaign_expenditures' && (
                                                    <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                        Campaign
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-slate-500 font-mono">
                                                    {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase border ${
                                                log.status === 'Approved' || log.status === 'Paid' || log.status === 'Active'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                    : log.status === 'Pending' || log.status === 'In Review' || log.status === 'Submitted'
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                                {log.status}
                                            </span>
                                        </div>

                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h5 className="text-[11px] font-bold text-white truncate">{log.title}</h5>
                                                <p className="text-[10px] text-slate-400 truncate">{log.description}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`text-xs font-mono font-bold block ${isCredit ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                    {isCredit ? '+' : '-'}${log.amountUSD.toFixed(2)}
                                                </span>
                                                {currentUser.currency !== 'USD' && (
                                                    <span className="text-[9px] text-slate-400 font-mono block">
                                                        {getCurrencySymbol()}{(log.amountUSD * exchangeRate).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-6 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-400 text-xs space-y-1">
                                <InfoIcon className="w-5 h-5 mx-auto text-slate-500" />
                                <p className="text-[11px]">No financial records match the filter.</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Purpose Logs Table (Hidden on Mobile) */}
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Date & Time</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Description / Details</th>
                                    <th className="py-3 px-4 text-right">Amount (USD)</th>
                                    <th className="py-3 px-4 text-right">Local Currency ({currentUser.currency})</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                                {paginatedPurposeLogs.length > 0 ? (
                                    paginatedPurposeLogs.map((log) => {
                                        const isCredit = log.type === 'credit';
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                                                    {new Date(log.date).toLocaleDateString()} <span className="text-slate-600">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {log.purpose === 'worker_earnings' && (
                                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                                            Task Reward Received
                                                        </span>
                                                    )}
                                                    {log.purpose === 'conversion_withdrawal' && (
                                                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                                            Converted / Withdrawn
                                                        </span>
                                                    )}
                                                    {log.purpose === 'campaign_transfers' && (
                                                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                                            Money Added
                                                        </span>
                                                    )}
                                                    {log.purpose === 'campaign_expenditures' && (
                                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                                            Campaign Cost
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs truncate text-slate-200">
                                                    <span className="font-bold block text-white truncate">{log.title}</span>
                                                    <span className="text-[11px] text-slate-400 truncate block">{log.description}</span>
                                                </td>
                                                <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${isCredit ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                    {isCredit ? '+' : '-'}${log.amountUSD.toFixed(2)} USD
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono text-slate-400 whitespace-nowrap">
                                                    {getCurrencySymbol()}{(log.amountUSD * exchangeRate).toFixed(2)} {currentUser.currency}
                                                </td>
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
                                                        log.status === 'Approved' || log.status === 'Paid' || log.status === 'Active'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                            : log.status === 'Pending' || log.status === 'In Review' || log.status === 'Submitted'
                                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                                    }`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center text-slate-500 text-xs">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <InfoIcon className="w-7 h-7 text-slate-600" />
                                                <span className="font-semibold text-slate-400">No financial records match the selected filter or search criteria.</span>
                                                {(purposeSearchQuery || historyPurposeFilter !== 'all' || purposeTypeFilter !== 'all') && (
                                                    <button
                                                        onClick={() => {
                                                            setPurposeSearchQuery('');
                                                            setHistoryPurposeFilter('all');
                                                            setPurposeTypeFilter('all');
                                                        }}
                                                        className="mt-1 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/40 transition-all"
                                                    >
                                                        Clear all filters
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Page-like Numbered Pagination Controls */}
                    {filteredPurposeLogs.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-slate-800 text-xs">
                            {/* Record Count Summary */}
                            <div className="text-slate-400 font-medium text-center sm:text-left text-[10px] sm:text-[11px]">
                                Showing <span className="font-bold text-white">{(purposeHistoryPage - 1) * purposeHistoryPerPage + 1}</span> to <span className="font-bold text-white">{Math.min(purposeHistoryPage * purposeHistoryPerPage, filteredPurposeLogs.length)}</span> of <span className="font-bold text-white">{filteredPurposeLogs.length}</span> entries
                            </div>

                            {/* Page Navigation Buttons */}
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                                {/* First Page */}
                                <button
                                    id="purpose-pagination-first-btn"
                                    onClick={() => setPurposeHistoryPage(1)}
                                    disabled={purposeHistoryPage === 1}
                                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="First Page"
                                >
                                    <ChevronsLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>

                                {/* Previous Page */}
                                <button
                                    id="purpose-pagination-prev-btn"
                                    onClick={() => setPurposeHistoryPage(prev => Math.max(1, prev - 1))}
                                    disabled={purposeHistoryPage === 1}
                                    className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-bold"
                                    title="Previous Page"
                                >
                                    <ChevronLeftIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    <span className="hidden sm:inline">Prev</span>
                                </button>

                                {/* Numbered Page Buttons */}
                                {(() => {
                                    const pages: (number | string)[] = [];
                                    if (totalPurposePages <= 5) {
                                        for (let i = 1; i <= totalPurposePages; i++) pages.push(i);
                                    } else {
                                        pages.push(1);
                                        if (purposeHistoryPage > 3) {
                                            pages.push('dots-1');
                                        }
                                        const start = Math.max(2, purposeHistoryPage - 1);
                                        const end = Math.min(totalPurposePages - 1, purposeHistoryPage + 1);
                                        for (let i = start; i <= end; i++) {
                                            pages.push(i);
                                        }
                                        if (purposeHistoryPage < totalPurposePages - 2) {
                                            pages.push('dots-2');
                                        }
                                        pages.push(totalPurposePages);
                                    }
                                    return pages.map((p, idx) => {
                                        if (typeof p === 'string') {
                                            return (
                                                <span key={p + idx} className="px-1 sm:px-2 py-0.5 text-slate-500 font-bold text-[10px] sm:text-xs select-none">
                                                    ...
                                                </span>
                                            );
                                        }
                                        const isActive = p === purposeHistoryPage;
                                        return (
                                            <button
                                                key={p}
                                                id={`purpose-pagination-page-${p}`}
                                                onClick={() => setPurposeHistoryPage(p)}
                                                className={`min-w-[28px] h-[28px] sm:min-w-[32px] sm:h-[32px] px-1.5 sm:px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center border ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/40'
                                                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    });
                                })()}

                                {/* Next Page */}
                                <button
                                    id="purpose-pagination-next-btn"
                                    onClick={() => setPurposeHistoryPage(prev => Math.min(totalPurposePages, prev + 1))}
                                    disabled={purposeHistoryPage === totalPurposePages}
                                    className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-bold"
                                    title="Next Page"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRightIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>

                                {/* Last Page */}
                                <button
                                    id="purpose-pagination-last-btn"
                                    onClick={() => setPurposeHistoryPage(totalPurposePages)}
                                    disabled={purposeHistoryPage === totalPurposePages}
                                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Last Page"
                                >
                                    <ChevronsRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Primary Navigation Bar */}
            <div className="bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl border border-slate-800 space-y-3 sm:space-y-4">
                
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-3 sm:pb-4">
                    {/* Primary Navigation Tabs */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <button
                            onClick={() => setDashboardTab('available_jobs')}
                            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                                dashboardTab === 'available_jobs'
                                     ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <TaskIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Available Jobs</span>
                            <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold font-mono ${
                                dashboardTab === 'available_jobs' ? 'bg-slate-950/80 text-amber-300' : 'bg-slate-950/60 text-slate-400'
                            }`}>
                                {availableHubTasks.length + DEFAULT_GIGS.filter(g => g.category === 'Available Jobs').length}
                            </span>
                        </button>

                        <button
                            onClick={() => setDashboardTab('other_tasks')}
                            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                                dashboardTab === 'other_tasks'
                                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            <GlobeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Other Tasks</span>
                        </button>
                    </div>

                    {/* Search Field */}
                    {dashboardTab === 'other_tasks' && (
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
                    )}
                </div>

                {/* Sub-Tabs for "Other Tasks" */}
                {dashboardTab === 'other_tasks' && (
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
                )}
            </div>

            {/* TAB CONTENT SECTION */}

            {/* TAB 1: AVAILABLE JOBS */}
            {dashboardTab === 'available_jobs' && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-xl space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3 sm:pb-4">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                                <TaskIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 truncate">
                                    Browse & Complete Micro-Tasks
                                </h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                                    Pick active jobs, follow step-by-step instructions, submit proof, and receive earnings to your Task Wallet.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl">
                                {availableHubTasks.length + DEFAULT_GIGS.filter(g => g.category === 'Available Jobs').length} Jobs Available
                            </span>
                        </div>
                    </div>

                    <UserTasksSubmit initialTab="browse" hideHeaderAndTabs={true} hideHeroBanner={true} />
                </div>
            )}

            {/* TAB 2: OTHER TASKS */}
            {dashboardTab === 'other_tasks' && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-xl space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3 sm:pb-4">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                                <GlobeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs sm:text-base font-bold text-white uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 truncate">
                                    {subTabs.find(s => s.id === activeSubTab)?.name || 'Partner'} Offers & External Tasks
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
                                                +{formatCurrency(gig.rewardUSD * exchangeRate, currentUser.currency)}
                                                {currentUser.currency !== 'USD' && (
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
            )}

            {/* MODAL 1: OFFERWALL GIG DETAIL */}
            {selectedGig && (
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

            {/* MODAL 2: USER TASK PROOF SUBMISSION (Hub Task) */}
            {proofTask && (
                <Modal isOpen={true} onClose={() => setProofTask(null)} title={`Submit Proof: ${proofTask.title}`}>
                    <form onSubmit={handleSubmitUserTaskProof} className="space-y-5 p-1">
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                                <span className="text-xs text-slate-400 block uppercase font-bold">Category</span>
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{proofTask.category} • {proofTask.subType}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-400 block uppercase font-bold">Reward</span>
                                <span className="font-black text-emerald-500 text-base sm:text-lg">
                                    +{formatCurrency((proofTask.rewardPerTask || 0) * exchangeRate, currentUser.currency)}
                                    {currentUser.currency !== 'USD' && (
                                        <span className="text-xs font-semibold text-slate-400 block">(${(Number(proofTask.rewardPerTask) || 0).toFixed(2)} USD)</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {proofTask.link && (
                            <a
                                href={proofTask.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md"
                            >
                                <span>Open Target Task URL</span>
                                <LaunchIcon className="w-4 h-4" />
                            </a>
                        )}

                        <div className="space-y-4">
                            {proofTask.requireTextProof && (
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold uppercase text-slate-300">
                                        Text Proof {proofTask.textProofInstruction && `(${proofTask.textProofInstruction})`}
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={taskProofText}
                                        onChange={(e) => setTaskProofText(e.target.value)}
                                        placeholder="Enter text proof or comments..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            )}

                            {proofTask.requireUsername && (
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold uppercase text-slate-300">
                                        Username Proof {proofTask.usernameInstruction && `(${proofTask.usernameInstruction})`}
                                    </label>
                                    <input
                                        type="text"
                                        value={taskProofUsername}
                                        onChange={(e) => setTaskProofUsername(e.target.value)}
                                        placeholder="@yourusername"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            )}

                            {proofTask.requireScreenshot && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold uppercase text-slate-300">
                                        Screenshot Proof {proofTask.screenshotInstruction && `(${proofTask.screenshotInstruction})`}
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleTaskProofImageUpload}
                                        className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400"
                                    />
                                    {taskProofImage && (
                                        <img src={taskProofImage} alt="Preview" className="h-32 object-cover rounded-2xl border border-slate-800 mt-2" />
                                    )}
                                </div>
                            )}
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider min-h-[44px]"
                            disabled={isSubmittingTaskProof}
                        >
                            {isSubmittingTaskProof ? 'Submitting Proof...' : 'Submit Proof to Creator'}
                        </Button>
                    </form>
                </Modal>
            )}

            {/* MODAL 3: VIEW SUBMISSION PROOF DETAIL */}
            {selectedSubmissionDetail && (
                <Modal isOpen={true} onClose={() => setSelectedSubmissionDetail(null)} title="Submission Proof Details">
                    <div className="space-y-4 p-1">
                        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                            <div>
                                <span className="text-[10px] text-amber-400 font-extrabold uppercase block tracking-wider">Status</span>
                                <span className="text-xs font-bold text-amber-300">
                                    {selectedSubmissionDetail.status === 'Pending' || selectedSubmissionDetail.status === 'Submitted' || selectedSubmissionDetail.status === 'In Review'
                                        ? 'Pending Review'
                                        : selectedSubmissionDetail.status}
                                </span>
                            </div>
                            {(selectedSubmissionDetail.status === 'Pending' || selectedSubmissionDetail.status === 'Submitted' || selectedSubmissionDetail.status === 'In Review') && (
                                <div className="text-right">
                                    <span className="text-[10px] text-amber-400 font-extrabold uppercase block tracking-wider">⏱ Auto-Approval In</span>
                                    <span className="text-xs font-black font-mono text-amber-300">
                                        {getRemainingTimeString(
                                            selectedSubmissionDetail.autoApproveAt ||
                                            (selectedSubmissionDetail.createdAt
                                                ? new Date(new Date(selectedSubmissionDetail.createdAt).getTime() + (state.settings?.systemLimits?.approvalTimeoutDays ?? 3) * 86400000)
                                                : null)
                                        ) || `${state.settings?.systemLimits?.approvalTimeoutDays ?? 3} days`}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-slate-400 uppercase font-bold block">Task Title</span>
                            <h4 className="font-bold text-white text-base">{selectedSubmissionDetail.taskTitle || 'User Task'}</h4>
                        </div>

                        {(() => {
                            const matchingTask = userTasks.find(t => t._id?.toString() === selectedSubmissionDetail.taskId?.toString());
                            const taskDesc = (selectedSubmissionDetail as any).taskDescription || matchingTask?.description;
                            return taskDesc ? (
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-400 uppercase font-bold block">Task Description</span>
                                    <p className="text-xs bg-slate-950 border border-slate-800 p-3 rounded-2xl text-slate-300 leading-relaxed whitespace-pre-line">
                                        {taskDesc}
                                    </p>
                                </div>
                            ) : null;
                        })()}

                        {selectedSubmissionDetail.proofText && (
                            <div className="space-y-1">
                                <span className="text-xs text-slate-400 uppercase font-bold block">Text Proof</span>
                                <p className="text-xs bg-slate-950 border border-slate-800 p-3 rounded-2xl text-slate-300">
                                    {selectedSubmissionDetail.proofText}
                                </p>
                            </div>
                        )}

                        {selectedSubmissionDetail.proofUsername && (
                            <div className="space-y-1">
                                <span className="text-xs text-slate-400 uppercase font-bold block">Username Proof</span>
                                <p className="text-xs bg-slate-950 border border-slate-800 p-3 rounded-2xl font-mono text-amber-300">
                                    {selectedSubmissionDetail.proofUsername}
                                </p>
                            </div>
                        )}

                        {selectedSubmissionDetail.proofImage && (
                            <div className="space-y-1">
                                <span className="text-xs text-slate-400 uppercase font-bold block">Screenshot Proof</span>
                                <img src={selectedSubmissionDetail.proofImage} alt="Screenshot Proof" className="w-full rounded-2xl border border-slate-800" />
                            </div>
                        )}

                        <Button
                            variant="secondary"
                            onClick={() => setSelectedSubmissionDetail(null)}
                            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                            Close
                        </Button>
                    </div>
                </Modal>
            )}

            {/* MODAL 4: DISPUTE MODAL */}
            {disputeSubmission && (
                <Modal isOpen={true} onClose={() => setDisputeSubmission(null)} title="Raise Task Dispute">
                    <form onSubmit={handleRaiseDisputeSubmit} className="space-y-4 p-1">
                        <p className="text-xs text-slate-400 leading-relaxed">
                            If your submission was unfairly rejected, explain your proof clearly for admin & creator review.
                        </p>

                        <div className="space-y-1">
                            <label className="block text-xs font-bold uppercase text-slate-300">Dispute Description</label>
                            <textarea
                                rows={4}
                                required
                                value={disputeDescription}
                                onChange={(e) => setDisputeDescription(e.target.value)}
                                placeholder="Detail why your proof was valid and complete..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider min-h-[44px]"
                            disabled={isSubmittingDispute}
                        >
                            {isSubmittingDispute ? 'Submitting Dispute...' : 'Submit Dispute'}
                        </Button>
                    </form>
                </Modal>
            )}

            {/* MODAL 5: CONVERT & WITHDRAW TASK WALLET BALANCE */}
            {isConvertModalOpen && (
                <Modal isOpen={true} onClose={() => setIsConvertModalOpen(false)} title="Convert & Withdraw Task Wallet Balance">
                    <div className="space-y-6 p-1">
                        <div className="bg-slate-950/90 p-4 rounded-2xl space-y-2 border border-slate-800">
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Task Wallet Balance</span>
                                <span className="font-bold text-amber-300 font-mono">${(currentUser.taskWalletBalance || 0).toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Registered Base Currency</span>
                                <span className="font-bold text-emerald-400 font-mono">{currentUser.currency}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Exchange Rate</span>
                                <span className="font-bold text-slate-200 font-mono">1 USD = {exchangeRate} {currentUser.currency}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
                                <span>Registered Base Value</span>
                                <span className="font-extrabold text-emerald-400 text-sm font-mono">
                                    {getCurrencySymbol()}{((currentUser.taskWalletBalance || 0) * exchangeRate).toFixed(2)} {currentUser.currency}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleConvertAmount} className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold uppercase text-slate-300">Amount to Convert (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={currentUser.taskWalletBalance || 0}
                                        value={convertAmount}
                                        onChange={(e) => setConvertAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-16 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setConvertAmount((currentUser.taskWalletBalance || 0).toString())}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg uppercase"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>

                            {convertAmount && !isNaN(Number(convertAmount)) && Number(convertAmount) > 0 && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold flex items-center justify-between font-mono">
                                    <span>You Will Receive ({currentUser.currency}):</span>
                                    <span>{(Number(convertAmount) * exchangeRate).toFixed(2)} {currentUser.currency}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleConvertAll}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs uppercase min-h-[44px]"
                                >
                                    Convert All
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase min-h-[44px]"
                                    disabled={isConverting}
                                >
                                    {isConverting ? 'Converting...' : `Convert to ${currentUser.currency}`}
                                </Button>
                            </div>
                        </form>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-400">Need to request a withdrawal?</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConvertModalOpen(false);
                                    navigate('/member/withdraw');
                                }}
                                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                            >
                                Withdraw ({currentUser.currency}) →
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default UserWorkAndEarnDashboard;
