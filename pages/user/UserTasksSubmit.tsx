import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, UserTask } from '../../types';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { createUserTask, submitUserTaskProof, convertUserCurrency, createDispute, convertTaskWalletBalance, updateSubmissionStatus } from '../../services/api';
import { canUserAccessTasks } from '../../src/utils/taskAccess';
import { Link } from 'react-router-dom';

const UserTasksSubmit: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, userTasks, userTaskSubmissions, settings } = state;

    const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number) => void) => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-500 font-bold">Page {currentPage} of {totalPages}</span>
                <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-end">
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === 1}
                        onClick={() => setPage(1)}
                    >
                        &laquo; First
                    </Button>
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                    >
                        &larr; Prev
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages)
                        .map((p, index, array) => {
                            const showEllipsis = index > 0 && p - array[index - 1] > 1;
                            return (
                                <React.Fragment key={p}>
                                    {showEllipsis && <span className="text-gray-400 px-1 font-bold">...</span>}
                                    <Button
                                        variant={currentPage === p ? 'primary' : 'secondary'}
                                        className={`py-1.5 px-3 font-black text-xs min-w-[2.25rem] h-9 flex items-center justify-center rounded-xl transition-all ${
                                            currentPage === p ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : ''
                                        }`}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </Button>
                                </React.Fragment>
                            );
                        })}

                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(currentPage + 1)}
                    >
                        Next &rarr;
                    </Button>
                    <Button
                        variant="secondary"
                        className="py-1.5 px-3 font-bold text-[10px] uppercase tracking-wider h-9"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(totalPages)}
                    >
                        Last &raquo;
                    </Button>
                </div>
            </div>
        );
    };

    const [activeTab, setActiveTab] = useState<'submit' | 'browse' | 'my-tasks' | 'pending-payment' | 'completed-tasks' | 'converter' | 'review-proofs'>('browse');
    const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);
    const [reviewFilter, setReviewFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [myCampaignFilter, setMyCampaignFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');

    // Dispute State
    const [selectedSubmissionForDispute, setSelectedSubmissionForDispute] = useState<any | null>(null);
    const [disputeDescription, setDisputeDescription] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Create Campaign Form State
    const [category, setCategory] = useState<string>('YouTube');
    const [subType, setSubType] = useState<string>('Subscribe');
    const [watchTimeTierIndex, setWatchTimeTierIndex] = useState<number>(0);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [targetQuantity, setTargetQuantity] = useState<number>(10);
    const [rewardPerTask, setRewardPerTask] = useState<number>(0.10); // in USD
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Creator Proof Requirements (Module A)
    const [requireTextProof, setRequireTextProof] = useState(false);
    const [textProofInstruction, setTextProofInstruction] = useState('');
    const [requireUsername, setRequireUsername] = useState(false);
    const [usernameInstruction, setUsernameInstruction] = useState('');
    const [requireUserId, setRequireUserId] = useState(false);
    const [userIdInstruction, setUserIdInstruction] = useState('');
    const [requireEmail, setRequireEmail] = useState(false);
    const [emailInstruction, setEmailInstruction] = useState('');
    const [requireScreenshot, setRequireScreenshot] = useState(true);
    const [screenshotInstruction, setScreenshotInstruction] = useState('Please upload screenshot proof of completion.');

    const [requiredProofsList, setRequiredProofsList] = useState<Array<{ id: string; type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual'; label: string; instruction: string }>>([
        { id: 'screenshot_1', type: 'screenshot', label: 'Screenshot / Image', instruction: 'Please upload screenshot proof of completion.' }
    ]);

    const addProofType = (type: 'text' | 'username' | 'userId' | 'email' | 'screenshot' | 'manual', label: string) => {
        const limits = settings?.userTaskProofLimits || {
            screenshot: { enabled: true, max: 2 },
            text: { enabled: true, max: 3 },
            username: { enabled: true, max: 3 },
            userId: { enabled: true, max: 3 },
            email: { enabled: true, max: 3 },
            manual: { enabled: true, max: 3 }
        };

        const config = limits[type] || { enabled: true, max: 5 };

        if (!config.enabled) {
            alert(`${label} proofs are currently disabled by the administrator.`);
            return;
        }

        const count = requiredProofsList.filter(p => p.type === type).length;
        if (count >= config.max) {
            alert(`The administrator has limited the number of duplicate ${label} proofs to ${config.max}. You cannot add any more.`);
            return;
        }

        const finalLabel = count > 0 ? `${label} #${count + 1}` : label;
        
        const newProof = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type,
            label: finalLabel,
            instruction: type === 'screenshot' ? 'Please upload screenshot proof of completion.' : `Please provide your ${label.toLowerCase()} details.`
        };
        setRequiredProofsList([...requiredProofsList, newProof]);
    };

    const removeProofItem = (id: string) => {
        setRequiredProofsList(requiredProofsList.filter(p => p.id !== id));
    };

    const updateProofInstruction = (id: string, instruction: string) => {
        setRequiredProofsList(requiredProofsList.map(p => p.id === id ? { ...p, instruction } : p));
    };

    // Proof Submission State (Module C)
    const [selectedTaskForProof, setSelectedTaskForProof] = useState<any | null>(null);
    const [proofStep, setProofStep] = useState<number>(1);
    const [proofText, setProofText] = useState('');
    const [proofUsername, setProofUsername] = useState('');
    const [proofUserIdVal, setProofUserIdVal] = useState('');
    const [proofEmail, setProofEmail] = useState('');
    const [proofImage, setProofImage] = useState('');
    const [submittedProofsValues, setSubmittedProofsValues] = useState<Record<string, string>>({});
    const [proofAgreed, setProofAgreed] = useState(false);
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [isTransferringTaskWallet, setIsTransferringTaskWallet] = useState(false);

    // Browse Tasks Filter & Pagination State
    const [browseSearch, setBrowseSearch] = useState('');
    const [browseCategory, setBrowseCategory] = useState('All');
    const [browseSort, setBrowseSort] = useState('latest');
    const [browsePage, setBrowsePage] = useState(1);
    const browseItemsPerPage = 6;

    // My Campaigns Search & Pagination State
    const [myCampaignsSearch, setMyCampaignsSearch] = useState('');
    const [myCampaignsPage, setMyCampaignsPage] = useState(1);
    const myCampaignsItemsPerPage = 10;

    // Pending Payments Search & Pagination State
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingPage, setPendingPage] = useState(1);
    const pendingItemsPerPage = 10;

    // Completed Tasks Search & Pagination State
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedPage, setCompletedPage] = useState(1);
    const completedItemsPerPage = 10;

    // Review Proofs Search & Pagination State
    const [reviewSearch, setReviewSearch] = useState('');
    const [reviewPage, setReviewPage] = useState(1);
    const reviewItemsPerPage = 10;

    const handleTransferTaskWallet = async () => {
        setIsTransferringTaskWallet(true);
        try {
            const res = await convertTaskWalletBalance({ userId: currentUser._id });
            dispatch({ type: 'UPDATE_USER', payload: res.user });
            alert(`Successfully transferred task wallet balance to Main MLM Balance (${res.convertedAmount} ${res.currency})!`);
            setShowConvertModal(false);
        } catch (error) {
            alert(`Failed to transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransferringTaskWallet(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            alert('Only PNG and JPG image formats are allowed.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setProofImage(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleDynamicImageUpload = (proofId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            alert('Only PNG and JPG image formats are allowed.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setSubmittedProofsValues(prev => ({ ...prev, [proofId]: dataUrl }));
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const europeanCountries = [ 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'United Kingdom' ];
    const allowedCurrency = currentUser.currency || (currentUser.country === 'Pakistan' ? 'PKR' : europeanCountries.includes(currentUser.country) ? 'EUR' : 'USD');

    // Currency Converter State
    const [convertAmount, setConvertAmount] = useState<number>(10);
    const [fromCurrency] = useState<string>('USD');
    const [toCurrency, setToCurrency] = useState<string>(allowedCurrency);
    const [conversionResult, setConversionResult] = useState<any>(null);
    const [isConverting, setIsConverting] = useState(false);

    if (!currentUser) return null;

    const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10 };
    const isEnabled = settings.isUserTaskEnabled ?? true;
    const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

    // Entire setup in USD for tasks
    const subtotal = targetQuantity * rewardPerTask; // in USD
    const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
    const totalBudgetUSD = Number((subtotal + adminCommission).toFixed(2));

    const DEFAULT_PRESETS = {
        youtube: {
            subscriber: { minPayout: 0.02, minSlots: 50 },
            comments: { minPayout: 0.04, minSlots: 10 },
            likes: { minPayout: 0.01, minSlots: 10 },
            watchTimeTiers: [
                { duration: '5 Seconds', minPayout: 0.005, minSlots: 100 },
                { duration: '10 Seconds', minPayout: 0.010, minSlots: 100 },
                { duration: '15 Seconds', minPayout: 0.015, minSlots: 100 },
                { duration: '30 Seconds', minPayout: 0.020, minSlots: 50 },
                { duration: '1 Minute', minPayout: 0.040, minSlots: 50 },
                { duration: '5 Minutes', minPayout: 0.150, minSlots: 20 },
            ]
        },
        facebook: {
            likeFollow: { minPayout: 0.02, minSlots: 50 },
            videoLike: { minPayout: 0.01, minSlots: 50 },
            comments: { minPayout: 0.03, minSlots: 10 },
            watchTimeTiers: [
                { duration: '30 Seconds', minPayout: 0.01, minSlots: 100 },
                { duration: '1 Minute', minPayout: 0.02, minSlots: 50 },
                { duration: '3 Minutes', minPayout: 0.05, minSlots: 50 },
            ]
        },
        instagram: {
            profileFollow: { minPayout: 0.015, minSlots: 50 },
            postLike: { minPayout: 0.008, minSlots: 100 },
            reelView: { minPayout: 0.005, minSlots: 100 },
            comments: { minPayout: 0.03, minSlots: 10 },
        },
        google: {
            reviews: { minPayout: 0.20, minSlots: 5 }
        },
        paidSignUp: {
            simpleSignUp: { minPayout: 0.10, minSlots: 10 },
            activePlanPurchase: { minPayout: 0.50, minSlots: 5 }
        }
    };

    const presets = settings.taskCategoryPresets || DEFAULT_PRESETS;

    // Get list of all categories from database presets
    const availableCategories = Object.keys(presets).map(key => {
        const cat = presets[key];
        const displayName = cat.displayName || (
            key === 'youtube' ? 'YouTube' :
            key === 'facebook' ? 'Facebook' :
            key === 'instagram' ? 'Instagram' :
            key === 'google' ? 'Google' :
            key === 'paidSignUp' ? 'Website' :
            key.charAt(0).toUpperCase() + key.slice(1)
        );
        return { key, displayName };
    });

    // Append "Other" catch-all if not present
    if (!availableCategories.some(c => c.key === 'other')) {
        availableCategories.push({ key: 'other', displayName: 'Other' });
    }

    // Find the preset key matching the selected category
    const activePresetKey = Object.keys(presets).find(k => 
        k.toLowerCase() === category.toLowerCase() || 
        (presets[k]?.displayName && presets[k].displayName.toLowerCase() === category.toLowerCase())
    ) || 'youtube';
    
    const activeCategoryConfig = presets[activePresetKey];
    const activeWatchTimeTiers = (activeCategoryConfig?.watchTimeTiers || []).filter((tier: any) => tier.enabled !== false);

    // Get subType options dynamically for this category
    const availableSubTypes = Object.keys(activeCategoryConfig || {}).filter(k => {
        if (k === 'enabled' || k === 'displayName' || k === 'watchTimeTiers') return false;
        return typeof activeCategoryConfig[k] === 'object' && activeCategoryConfig[k] !== null;
    }).map(subKey => {
        const subConf = activeCategoryConfig[subKey];
        const displayName = subConf?.displayName || (
            subKey === 'subscriber' ? 'Subscribe' :
            subKey === 'likes' ? 'Like' :
            subKey === 'comments' ? 'Comment' :
            subKey === 'likeFollow' ? 'Follow' :
            subKey === 'videoLike' ? 'Like' :
            subKey === 'profileFollow' ? 'Follow' :
            subKey === 'postLike' ? 'Like' :
            subKey === 'reelView' ? 'Watch Time' :
            subKey === 'reviews' ? 'Review' :
            subKey === 'simpleSignUp' ? 'Sign-up' :
            subKey === 'activePlanPurchase' ? 'Other' :
            subKey.charAt(0).toUpperCase() + subKey.slice(1)
        );
        return { key: subKey, displayName };
    });

    // If watchTimeTiers exists, add "Watch Time" option
    const hasWatchTimeTiers = activeCategoryConfig?.watchTimeTiers && Array.isArray(activeCategoryConfig.watchTimeTiers);
    if (hasWatchTimeTiers && !availableSubTypes.some(s => s.displayName === 'Watch Time')) {
        availableSubTypes.push({ key: 'watchTimeTiers', displayName: 'Watch Time' });
    }

    // Append "Other" catch-all subtype if not present
    if (!availableSubTypes.some(s => s.key === 'other')) {
        availableSubTypes.push({ key: 'other', displayName: 'Other' });
    }

    const getSelectionLimits = () => {
        let minPayout = config.minRewardAmount;
        let minSlots = config.minQuantity;
        let isPresetFound = false;
        let presetName = '';

        if (activeCategoryConfig) {
            // Find if there is a matching subcategory based on selected subType displayName or subKey
            const subKey = Object.keys(activeCategoryConfig).find(k => {
                if (k === 'enabled' || k === 'displayName') return false;
                if (k === 'watchTimeTiers') {
                    return subType === 'Watch Time';
                }
                const subConf = activeCategoryConfig[k];
                const subDisp = subConf?.displayName || k;
                return k.toLowerCase() === subType.toLowerCase() || subDisp.toLowerCase() === subType.toLowerCase() ||
                    (k === 'subscriber' && subType === 'Subscribe') ||
                    (k === 'likes' && subType === 'Like') ||
                    (k === 'comments' && subType === 'Comment') ||
                    (k === 'likeFollow' && subType === 'Follow') ||
                    (k === 'videoLike' && subType === 'Like') ||
                    (k === 'profileFollow' && subType === 'Follow') ||
                    (k === 'postLike' && subType === 'Like') ||
                    (k === 'reelView' && subType === 'Watch Time') ||
                    (k === 'reviews' && subType === 'Review') ||
                    (k === 'simpleSignUp' && subType === 'Sign-up') ||
                    (k === 'activePlanPurchase' && subType === 'Other');
            });

            if (subKey === 'watchTimeTiers') {
                const tiers = activeCategoryConfig.watchTimeTiers || [];
                const selectedTier = tiers[watchTimeTierIndex] || tiers[0];
                if (selectedTier) {
                    minPayout = selectedTier.minPayout;
                    minSlots = selectedTier.minSlots;
                    presetName = `${category} Watch Time (${selectedTier.duration})`;
                    isPresetFound = true;
                }
            } else if (subKey) {
                const subConfig = activeCategoryConfig[subKey];
                minPayout = subConfig.minPayout ?? config.minRewardAmount;
                minSlots = subConfig.minSlots ?? config.minQuantity;
                presetName = `${category} ${subConfig.displayName || subKey.charAt(0).toUpperCase() + subKey.slice(1)}`;
                isPresetFound = true;
            }
        }

        return { minPayout, minSlots, isPresetFound, presetName };
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEnabled) return alert('User task submissions are currently disabled.');
        if (!title || !link) return alert('Please fill in title and target link.');

        const { minPayout, minSlots, presetName } = getSelectionLimits();
        if (targetQuantity < minSlots) {
            return alert(`For ${presetName || 'this task type'}, the minimum slots (target quantity) required by the admin is ${minSlots}.`);
        }
        if (rewardPerTask < minPayout) {
            return alert(`For ${presetName || 'this task type'}, the minimum reward per task required by the admin is $${minPayout} USD.`);
        }

        let finalTitle = title;
        if (subType === 'Watch Time') {
            const tiers = activeCategoryConfig?.watchTimeTiers || [];
            const selectedTier = tiers[watchTimeTierIndex] || tiers[0];
            if (selectedTier && !title.includes(selectedTier.duration)) {
                finalTitle = `${title} (${selectedTier.duration} Watch Time)`;
            }
        }

        if (requiredProofsList.length === 0) {
            return alert('Please configure at least one required proof requirement (Module A).');
        }

        for (const item of requiredProofsList) {
            if (!item.instruction.trim()) {
                return alert(`Please provide instructions for the proof requirement: ${item.label}`);
            }
        }

        const legacyRequireTextProof = requiredProofsList.some(p => p.type === 'text' || p.type === 'manual');
        const legacyTextProofInstruction = requiredProofsList.filter(p => p.type === 'text' || p.type === 'manual').map(p => p.instruction).join(' | ') || '';

        const legacyRequireUsername = requiredProofsList.some(p => p.type === 'username');
        const legacyUsernameInstruction = requiredProofsList.filter(p => p.type === 'username').map(p => p.instruction).join(' | ') || '';

        const legacyRequireUserId = requiredProofsList.some(p => p.type === 'userId');
        const legacyUserIdInstruction = requiredProofsList.filter(p => p.type === 'userId').map(p => p.instruction).join(' | ') || '';

        const legacyRequireEmail = requiredProofsList.some(p => p.type === 'email');
        const legacyEmailInstruction = requiredProofsList.filter(p => p.type === 'email').map(p => p.instruction).join(' | ') || '';

        const legacyRequireScreenshot = requiredProofsList.some(p => p.type === 'screenshot');
        const legacyScreenshotInstruction = requiredProofsList.filter(p => p.type === 'screenshot').map(p => p.instruction).join(' | ') || '';

        // Convert totalBudgetUSD to user currency for balance verification
        const userCurr = currentUser.currency || 'USD';
        let budgetInUserCurr = totalBudgetUSD * (rates[userCurr] || 1);
        budgetInUserCurr = Number(budgetInUserCurr.toFixed(2));

        if (currentUser.walletBalance < budgetInUserCurr) {
            return alert(`Insufficient wallet balance. Total cost is ${budgetInUserCurr} ${userCurr} (${totalBudgetUSD} USD), you have ${currentUser.walletBalance} ${userCurr}. Please convert funds or deposit.`);
        }

        setIsSubmitting(true);
        try {
            const result = await createUserTask({
                userId: currentUser._id,
                category,
                subType,
                title: finalTitle,
                description,
                link,
                targetQuantity: Number(targetQuantity),
                rewardPerTask: Number(rewardPerTask), // in USD
                requireTextProof: legacyRequireTextProof,
                textProofInstruction: legacyTextProofInstruction,
                requireUsername: legacyRequireUsername,
                usernameInstruction: legacyUsernameInstruction,
                requireUserId: legacyRequireUserId,
                userIdInstruction: legacyUserIdInstruction,
                requireEmail: legacyRequireEmail,
                emailInstruction: legacyEmailInstruction,
                requireScreenshot: legacyRequireScreenshot,
                screenshotInstruction: legacyScreenshotInstruction,
                requiredProofs: requiredProofsList
            });
            dispatch({ type: 'ADD_USER_TASK', payload: result.task });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            alert('Task campaign submitted successfully in USD and funds deducted from your wallet!');
            setTitle('');
            setDescription('');
            setLink('');
            setActiveTab('my-tasks');
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProofSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaskForProof) return;

        if (!proofAgreed) {
            return alert("WARNING: If you submit incorrect proof or do not complete the task properly, your account may be banned and your balance may be deducted. Please check the warning confirmation agreement checkbox to proceed.");
        }

        const proofsToSubmit: Array<{ id: string; type: string; label: string; value: string }> = [];
        let finalProofText = proofText;
        let finalProofUsername = proofUsername;
        let finalProofUserIdVal = proofUserIdVal;
        let finalProofEmail = proofEmail;
        let finalProofImage = proofImage;

        if (selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0) {
            for (const req of selectedTaskForProof.requiredProofs) {
                const val = (submittedProofsValues[req.id] || '').trim();
                if (!val) {
                    return alert(`Please provide required proof: "${req.label}"\nInstruction: ${req.instruction}`);
                }
                proofsToSubmit.push({
                    id: req.id,
                    type: req.type,
                    label: req.label,
                    value: val
                });
            }

            // Populate legacy fields with first occurrence for backwards compatibility
            const firstText = proofsToSubmit.find(p => p.type === 'text' || p.type === 'manual')?.value;
            const firstUsername = proofsToSubmit.find(p => p.type === 'username')?.value;
            const firstUserId = proofsToSubmit.find(p => p.type === 'userId')?.value;
            const firstEmail = proofsToSubmit.find(p => p.type === 'email')?.value;
            const firstScreenshot = proofsToSubmit.find(p => p.type === 'screenshot')?.value;

            if (firstText) finalProofText = firstText;
            if (firstUsername) finalProofUsername = firstUsername;
            if (firstUserId) finalProofUserIdVal = firstUserId;
            if (firstEmail) finalProofEmail = firstEmail;
            if (firstScreenshot) finalProofImage = firstScreenshot;
        } else {
            if (selectedTaskForProof.requireTextProof && !proofText.trim()) return alert(selectedTaskForProof.textProofInstruction || 'Text proof is required.');
            if (selectedTaskForProof.requireUsername && !proofUsername.trim()) return alert(selectedTaskForProof.usernameInstruction || 'Username is required.');
            if (selectedTaskForProof.requireUserId && !proofUserIdVal.trim()) return alert(selectedTaskForProof.userIdInstruction || 'User ID is required.');
            if (selectedTaskForProof.requireEmail && !proofEmail.trim()) return alert(selectedTaskForProof.emailInstruction || 'Email is required.');
            if (selectedTaskForProof.requireScreenshot && !proofImage) return alert(selectedTaskForProof.screenshotInstruction || 'Screenshot image is required.');
            
            if (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot) {
                if (!proofText.trim() && !proofImage) return alert('Please provide proof text or screenshot.');
            }
        }

        setIsSubmittingProof(true);
        try {
            const submission = await submitUserTaskProof(selectedTaskForProof._id, {
                userId: currentUser._id,
                proofText: finalProofText,
                proofUsername: finalProofUsername,
                proofUserIdVal: finalProofUserIdVal,
                proofEmail: finalProofEmail,
                proofImage: finalProofImage,
                submittedProofs: proofsToSubmit
            });
            dispatch({ type: 'ADD_USER_TASK_SUBMISSION', payload: submission });
            alert('Proof submitted successfully! Awaiting admin review for USD reward.');
            setSelectedTaskForProof(null);
            setProofText('');
            setProofUsername('');
            setProofUserIdVal('');
            setProofEmail('');
            setProofImage('');
            setSubmittedProofsValues({});
            setActiveTab('pending-payment');
        } catch (error) {
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingProof(false);
        }
    };

    const handleRunConversion = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(convertAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }
        if ((currentUser.taskWalletBalance || 0) < amt) {
            alert('You do not have enough amount for conversion.');
            return;
        }
        setIsConverting(true);
        try {
            const res = await convertUserCurrency({
                userId: currentUser._id,
                amount: amt,
                fromCurrency,
                toCurrency
            });
            setConversionResult(res);
            if (res && res.user) {
                dispatch({ type: 'UPDATE_USER', payload: res.user });
            }
        } catch (error) {
            alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsConverting(false);
        }
    };

    const handleDisputeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubmissionForDispute) return;
        setIsSubmittingDispute(true);
        try {
            const formData = new FormData();
            formData.append('userId', currentUser._id);
            formData.append('userName', currentUser.name || currentUser.email);
            formData.append('type', 'UserTask');
            formData.append('referenceId', selectedSubmissionForDispute._id);
            formData.append('description', disputeDescription || `Dispute for task submission: ${selectedSubmissionForDispute.taskTitle}`);
            
            await createDispute(formData);
            alert('Dispute submitted successfully to Admin! Admin will review the proof and resolve it.');
            setSelectedSubmissionForDispute(null);
            setDisputeDescription('');
        } catch (error) {
            alert(`Failed to submit dispute: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const mySubmittedTasks = userTasks.filter(t => t.userId?.toString() === currentUser._id?.toString());
    const mySubmissions = userTaskSubmissions.filter(s => s.workerId?.toString() === currentUser._id?.toString());
    
    // Submissions made by workers for campaigns created by current user
    const campaignSubmissions = userTaskSubmissions.filter(s => 
        mySubmittedTasks.some(t => t._id?.toString() === s.taskId?.toString())
    );

    const handleApproveSubmission = async (subId: string) => {
        if (!window.confirm("Are you sure you want to approve this submission and release the reward?")) return;
        try {
            const updated = await updateSubmissionStatus(subId, { status: 'Approved' });
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
            alert("Submission approved and rewarded successfully!");
        } catch (error) {
            alert(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleRejectSubmission = async (subId: string) => {
        const reason = window.prompt("Please enter the reason for rejecting this submission:");
        if (reason === null) return;
        if (!reason.trim()) return alert("Rejection reason is required.");
        try {
            const updated = await updateSubmissionStatus(subId, { 
                status: 'Rejected', 
                rejectionReason: reason,
                adminNotes: reason
            });
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
            alert("Submission rejected successfully.");
        } catch (error) {
            alert(`Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const browseableTasks = userTasks.filter(t => t.status === 'Approved' && t.userId?.toString() !== currentUser._id?.toString() && t.currentCompletions < t.targetQuantity && !mySubmissions.some(s => s.taskId?.toString() === t._id?.toString()));
    const pendingSubmissions = mySubmissions.filter(s => s.status === 'Pending');
    const completedSubmissions = mySubmissions.filter(s => s.status === 'Approved');

    // 1. Browse Tab Filtration & Pagination
    const filteredBrowseableTasks = browseableTasks
        .filter(t => {
            const matchesSearch = browseSearch === '' || 
                (t.title && t.title.toLowerCase().includes(browseSearch.toLowerCase())) || 
                (t.description && t.description.toLowerCase().includes(browseSearch.toLowerCase()));
            const matchesCategory = browseCategory === 'All' || t.category === browseCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            if (browseSort === 'reward-desc') {
                return (b.rewardPerTask || 0) - (a.rewardPerTask || 0);
            }
            if (browseSort === 'reward-asc') {
                return (a.rewardPerTask || 0) - (b.rewardPerTask || 0);
            }
            if (browseSort === 'quantity-desc') {
                return (b.targetQuantity || 0) - (a.targetQuantity || 0);
            }
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

    const totalBrowsePages = Math.max(1, Math.ceil(filteredBrowseableTasks.length / browseItemsPerPage));
    const paginatedBrowseTasks = filteredBrowseableTasks.slice(
        (browsePage - 1) * browseItemsPerPage,
        browsePage * browseItemsPerPage
    );

    // 2. My Campaigns Tab Filtration & Pagination
    const filteredMyCampaignsList = mySubmittedTasks
        .filter(t => {
            const matchesSearch = myCampaignsSearch === '' || 
                (t.title && t.title.toLowerCase().includes(myCampaignsSearch.toLowerCase())) || 
                (t.description && t.description.toLowerCase().includes(myCampaignsSearch.toLowerCase()));
            
            let matchesStatus = true;
            if (myCampaignFilter === 'pending') matchesStatus = t.status === 'Pending';
            else if (myCampaignFilter === 'approved') matchesStatus = t.status === 'Approved' && t.currentCompletions < t.targetQuantity;
            else if (myCampaignFilter === 'completed') matchesStatus = t.status === 'Completed' || t.currentCompletions >= t.targetQuantity;
            else if (myCampaignFilter === 'rejected') matchesStatus = t.status === 'Rejected';

            return matchesSearch && matchesStatus;
        });

    const totalMyCampaignsPages = Math.max(1, Math.ceil(filteredMyCampaignsList.length / myCampaignsItemsPerPage));
    const paginatedMyCampaigns = filteredMyCampaignsList.slice(
        (myCampaignsPage - 1) * myCampaignsItemsPerPage,
        myCampaignsPage * myCampaignsItemsPerPage
    );

    // 3. Pending Submissions Tab Filtration & Pagination
    const filteredPendingSubmissions = pendingSubmissions
        .filter(s => {
            const titleMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(pendingSearch.toLowerCase());
            const proofMatch = s.proofText && s.proofText.toLowerCase().includes(pendingSearch.toLowerCase());
            return pendingSearch === '' || titleMatch || proofMatch;
        });

    const totalPendingPages = Math.max(1, Math.ceil(filteredPendingSubmissions.length / pendingItemsPerPage));
    const paginatedPendingSubmissions = filteredPendingSubmissions.slice(
        (pendingPage - 1) * pendingItemsPerPage,
        pendingPage * pendingItemsPerPage
    );

    // 4. Completed Submissions Tab Filtration & Pagination
    const filteredCompletedSubmissions = completedSubmissions
        .filter(s => {
            const titleMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(completedSearch.toLowerCase());
            const proofMatch = s.proofText && s.proofText.toLowerCase().includes(completedSearch.toLowerCase());
            return completedSearch === '' || titleMatch || proofMatch;
        });

    const totalCompletedPages = Math.max(1, Math.ceil(filteredCompletedSubmissions.length / completedItemsPerPage));
    const paginatedCompletedSubmissions = filteredCompletedSubmissions.slice(
        (completedPage - 1) * completedItemsPerPage,
        completedPage * completedItemsPerPage
    );

    // 5. Review Proofs Tab Filtration & Pagination
    const filteredReviewCampaignSubmissions = campaignSubmissions
        .filter(s => reviewFilter === 'All' || s.status === reviewFilter)
        .filter(s => {
            if (reviewSearch === '') return true;
            const workerMatch = s.workerName && s.workerName.toLowerCase().includes(reviewSearch.toLowerCase());
            const taskMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(reviewSearch.toLowerCase());
            const textProofMatch = s.proofText && s.proofText.toLowerCase().includes(reviewSearch.toLowerCase());
            return workerMatch || taskMatch || textProofMatch;
        });

    const totalReviewPages = Math.max(1, Math.ceil(filteredReviewCampaignSubmissions.length / reviewItemsPerPage));
    const paginatedReviewSubmissions = filteredReviewCampaignSubmissions.slice(
        (reviewPage - 1) * reviewItemsPerPage,
        reviewPage * reviewItemsPerPage
    );

    const hasAccess = canUserAccessTasks(currentUser, settings);

    if (!hasAccess) {
        return (
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-12 shadow-2xl border dark:border-gray-700 text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl mx-auto flex items-center justify-center text-3xl font-black">
                        🔒
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">User Task Hub Locked</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium leading-relaxed">
                        {settings.userTaskNotificationEnabled !== false 
                            ? (settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the User Task Hub and start earning today!')
                            : 'Access to the User Task Hub is restricted by the administrator.'}
                    </p>
                    <div className="pt-4 flex flex-wrap justify-center gap-4">
                        <Link to="/member/plans">
                            <Button variant="primary" className="px-8 py-3.5 rounded-2xl shadow-lg">
                                View Investment Plans & Activate
                            </Button>
                        </Link>
                        <Link to="/member">
                            <Button variant="secondary" className="px-8 py-3.5 rounded-2xl">
                                Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="bg-[#0f172a] p-8 md:p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">User Task Hub (USD)</h1>
                        <p className="mt-2 text-blue-100/70 font-medium uppercase text-xs tracking-widest ml-1">Create USD campaigns, complete tasks with proof, and convert currency</p>
                    </div>
                    <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-8 px-8 md:mx-0 md:px-0 md:flex-wrap gap-2 w-full md:w-auto pb-3 md:pb-0 scroll-smooth snap-x">
                        {[
                            { id: 'browse', label: 'Available Tasks', count: browseableTasks.length, icon: '📋' },
                            { id: 'pending-payment', label: 'Pending Payment', count: pendingSubmissions.length, icon: '⏳' },
                            { id: 'completed-tasks', label: 'Completed Tasks', count: completedSubmissions.length, icon: '✅' },
                            { id: 'submit', label: 'Create Campaign', icon: '🚀' },
                            { id: 'my-tasks', label: 'My Campaigns', count: mySubmittedTasks.length, icon: '📂' },
                            { id: 'review-proofs', label: 'Review Proofs', count: campaignSubmissions.filter(s => s.status === 'Pending').length, icon: '👁️' },
                            { id: 'converter', label: 'Converter', icon: '🔄' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`snap-center shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 select-none ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 scale-[1.03] border-2 border-transparent'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
                                }`}
                            >
                                <span className="text-sm">{tab.icon}</span>
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                        activeTab === tab.id ? 'bg-blue-800 text-blue-200' : 'bg-white/10 text-gray-400'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Balance Widget & Quick Actions */}
            <div className="bg-gradient-to-r from-blue-950 to-slate-900 p-6 md:p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col lg:flex-row justify-between items-center gap-6 border border-blue-500/15">
                <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-12 h-12 shrink-0 bg-blue-600/20 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-400 border border-blue-500/30 shadow-inner">
                            💲
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 block">Available Task Balance</span>
                            <span className="text-2xl font-black tracking-tight text-white block">
                                ${(currentUser.taskWalletBalance || 0).toFixed(2)} USD
                            </span>
                        </div>
                    </div>
                    
                    <div className="hidden sm:block h-10 w-px bg-white/10"></div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-12 h-12 shrink-0 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-400 border border-emerald-500/30 shadow-inner">
                            💳
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Main MLM Balance</span>
                            <span className="text-2xl font-black tracking-tight text-white block">
                                {(currentUser.walletBalance || 0).toFixed(2)} {currentUser.currency || 'USD'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
                    <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Registered Currency</span>
                        <span className="text-sm font-black text-emerald-400">{currentUser.currency || 'USD'}</span>
                    </div>
                    <Button 
                        variant="primary" 
                        onClick={() => setShowConvertModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105 w-full sm:w-auto justify-center"
                    >
                        <span>Convert & Transfer to Main Wallet</span>
                        <span>⚡</span>
                    </Button>
                </div>
            </div>

            {!isEnabled && (
                <div className="bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 p-6 rounded-3xl font-bold text-center">
                    User task submissions are currently disabled by the administrator.
                </div>
            )}

            {/* TAB 1: CREATE CAMPAIGN */}
            {activeTab === 'submit' && isEnabled && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Create USD Task Campaign</h3>
                        
                        <form onSubmit={handleCreateCampaign} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Category / Platform</label>
                                    <select 
                                        value={category} 
                                        onChange={(e) => {
                                            const catVal = e.target.value;
                                            setCategory(catVal);
                                            
                                            // Pre-adjust subType for the newly selected category
                                            const newPresetKey = Object.keys(presets).find(k => 
                                                k.toLowerCase() === catVal.toLowerCase() || 
                                                (presets[k]?.displayName && presets[k].displayName.toLowerCase() === catVal.toLowerCase())
                                            ) || 'youtube';
                                            const newCategoryConfig = presets[newPresetKey];
                                            if (newCategoryConfig) {
                                                const newSubKeys = Object.keys(newCategoryConfig).filter(k => {
                                                    if (k === 'enabled' || k === 'displayName' || k === 'watchTimeTiers') return false;
                                                    if (newCategoryConfig[k]?.enabled === false) return false;
                                                    return typeof newCategoryConfig[k] === 'object' && newCategoryConfig[k] !== null;
                                                });
                                                if (newSubKeys.length > 0) {
                                                    const firstSubPreset = newCategoryConfig[newSubKeys[0]];
                                                    setSubType(firstSubPreset?.displayName || newSubKeys[0].charAt(0).toUpperCase() + newSubKeys[0].slice(1));
                                                } else if (newCategoryConfig.watchTimeTiers && newCategoryConfig.watchTimeTiers.some((t: any) => t.enabled !== false)) {
                                                    setSubType('Watch Time');
                                                } else {
                                                    setSubType('Other');
                                                }
                                            } else {
                                                setSubType('Other');
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        {availableCategories.map(cat => (
                                            <option key={cat.key} value={cat.displayName}>{cat.displayName}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">Action / SubType</label>
                                    <select 
                                        value={subType} 
                                        onChange={(e) => setSubType(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    >
                                        {availableSubTypes.map(sub => (
                                            <option key={sub.key} value={sub.displayName}>{sub.displayName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {subType === 'Watch Time' && activeWatchTimeTiers.length > 0 && (
                                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-blue-100 dark:border-gray-700 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-black uppercase text-blue-600 dark:text-blue-400">Select Watch Time Duration Tier</label>
                                    <select
                                        value={watchTimeTierIndex}
                                        onChange={(e) => setWatchTimeTierIndex(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-950 border border-blue-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-sm"
                                    >
                                        {activeWatchTimeTiers.map((tier: any, idx: number) => {
                                            const originalIdx = (activeCategoryConfig?.watchTimeTiers || []).findIndex((t: any) => t.duration === tier.duration);
                                            return (
                                                <option key={idx} value={originalIdx !== -1 ? originalIdx : idx}>
                                                    {tier.duration} (Min Amount: ${tier.minPayout} | Min Slots: {tier.minSlots})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Campaign Title</label>
                                <input 
                                    type="text" 
                                    required
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Website Sign-up & Verify Email"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Target Link / URL</label>
                                <input 
                                    type="url" 
                                    required
                                    value={link} 
                                    onChange={(e) => setLink(e.target.value)}
                                    placeholder="https://example.com/signup"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Description & Proof Instructions</label>
                                <textarea 
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide clear instructions for workers (e.g. Sign up with email, submit your username and screenshot)"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                ></textarea>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                        Target Quantity (Min {getSelectionLimits().minSlots})
                                    </label>
                                    <input 
                                        type="number" 
                                        min={getSelectionLimits().minSlots}
                                        value={targetQuantity} 
                                        onChange={(e) => setTargetQuantity(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    />
                                    {getSelectionLimits().isPresetFound && (
                                        <p className="mt-1.5 text-xs text-blue-500 font-bold">
                                            Admin required min slots for {getSelectionLimits().presetName} is {getSelectionLimits().minSlots}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                        Reward Per Task (Min ${getSelectionLimits().minPayout.toFixed(3)} USD)
                                    </label>
                                    <input 
                                        type="number" 
                                        step="0.001"
                                        min={getSelectionLimits().minPayout}
                                        value={rewardPerTask} 
                                        onChange={(e) => setRewardPerTask(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                    />
                                    {getSelectionLimits().isPresetFound && (
                                        <p className="mt-1.5 text-xs text-blue-500 font-bold">
                                            Admin locked min payout is ${getSelectionLimits().minPayout.toFixed(3)} USD
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Module A: Dynamic Proof Requirements Form Builder */}
                            <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-700">
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Configure Required Proofs (Module A)</h4>
                                
                                <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-black uppercase text-gray-400">Add Required Proof Type:</span>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => addProofType('screenshot', 'Screenshot / Image')}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">+</span> 📸 Screenshot / Image
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => addProofType('text', 'Text Proof')}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+</span> 📝 Text Proof
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => addProofType('username', 'Username')}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-purple-600 dark:text-purple-400">+</span> 👤 Username
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => addProofType('userId', 'User ID')}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-amber-600 dark:text-amber-400">+</span> 🆔 User ID
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => addProofType('email', 'Email')}
                                                className="px-3.5 py-2 text-xs font-black rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 hover:scale-105 transition-transform flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span className="text-sm font-black text-rose-600 dark:text-rose-400">+</span> 📧 Email
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 bg-white dark:bg-gray-800 p-2.5 rounded-2xl border dark:border-gray-700 shadow-inner">
                                        <input
                                            type="text"
                                            id="custom-proof-manual-input"
                                            placeholder="Or enter manual entry name (e.g. Profile URL)..."
                                            className="flex-1 bg-transparent border-none text-xs font-medium focus:ring-0 px-2 text-gray-900 dark:text-white"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                    if (val) {
                                                        addProofType('manual', val);
                                                        (e.currentTarget as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const el = document.getElementById('custom-proof-manual-input') as HTMLInputElement;
                                                const val = el?.value.trim();
                                                if (val) {
                                                    addProofType('manual', val);
                                                    el.value = '';
                                                } else {
                                                    alert("Please enter a label for manual entry proof.");
                                                }
                                            }}
                                            className="px-4 py-2 text-xs font-black rounded-xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 hover:scale-105 transition-all flex items-center gap-1 shrink-0"
                                        >
                                            <span className="font-bold">+</span> Add Manual Entry
                                        </button>
                                    </div>

                                    {/* Configured Proofs List */}
                                    <div className="space-y-3 pt-2">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Proof Requirements list:</span>
                                        {requiredProofsList.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic text-center py-4 bg-white dark:bg-gray-800 rounded-2xl border border-dashed dark:border-gray-700">
                                                No proofs configured yet. Please add at least one required proof above.
                                            </p>
                                        ) : (
                                            requiredProofsList.map((proof, index) => (
                                                <div key={proof.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-sm space-y-2.5 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                                #{index + 1}
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white">
                                                                {proof.type === 'screenshot' ? '📸' : 
                                                                 proof.type === 'text' ? '📝' : 
                                                                 proof.type === 'username' ? '👤' : 
                                                                 proof.type === 'userId' ? '🆔' : 
                                                                 proof.type === 'email' ? '📧' : '✍️'} {proof.label}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeProofItem(proof.id)}
                                                            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition-colors"
                                                        >
                                                            <span>🗑️</span> Remove
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={proof.instruction}
                                                        onChange={(e) => updateProofInstruction(proof.id, e.target.value)}
                                                        placeholder={`Instruction for worker (e.g. Enter your ${proof.label.toLowerCase()})`}
                                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full py-4 text-lg">
                                Launch Campaign ({totalBudgetUSD} USD)
                            </Button>
                        </form>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-[#0f172a] text-white rounded-[2.5rem] p-8 md:p-10 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold uppercase tracking-tight text-blue-400 mb-6">Campaign Summary (USD)</h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Target Completions</span>
                                    <span className="font-bold">{targetQuantity} users</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Reward / Task</span>
                                    <span className="font-bold">{rewardPerTask.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Subtotal Rewards</span>
                                    <span className="font-bold">{subtotal.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-800">
                                    <span className="text-gray-400">Admin Commission ({config.commissionPercent}%)</span>
                                    <span className="font-bold">{adminCommission.toFixed(2)} USD</span>
                                </div>
                                <div className="flex justify-between py-3 text-lg font-black text-emerald-400">
                                    <span>Total Budget</span>
                                    <span>{totalBudgetUSD} USD</span>
                                </div>
                                {getSelectionLimits().isPresetFound && (
                                    <div className="mt-4 p-4 rounded-2xl bg-blue-950/40 border border-blue-900 text-xs space-y-2">
                                        <p className="font-bold text-blue-400 uppercase tracking-wider">🔒 Admin Verified Preset</p>
                                        <p className="text-gray-300">This task type is configured platform-wide:</p>
                                        <ul className="list-disc pl-4 text-gray-400 space-y-1">
                                            <li>Min Required Price: <strong>${getSelectionLimits().minPayout.toFixed(3)} USD</strong></li>
                                            <li>Min Required Slots: <strong>{getSelectionLimits().minSlots} users</strong></li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-gray-900/60 rounded-3xl border border-gray-800">
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Funds will be deducted from your wallet balance in USD equivalent. When workers submit valid proof (screenshot, ID, or link), admin approves and workers receive their USD rewards instantly!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: BROWSE & EARN TASKS */}
            {activeTab === 'browse' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Available Tasks to Complete & Earn USD</h3>
                            <p className="text-xs text-gray-500 mt-1">Browse available micro-tasks approved by admin, complete tasks using instructions, and earn rewards paid in USD.</p>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[2rem] shadow-md border dark:border-gray-700/60 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input 
                                type="text"
                                placeholder="Search task title or description..."
                                value={browseSearch}
                                onChange={(e) => {
                                    setBrowseSearch(e.target.value);
                                    setBrowsePage(1); // Reset page on filter change
                                }}
                                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Category:</span>
                                <select 
                                    value={browseCategory}
                                    onChange={(e) => {
                                        setBrowseCategory(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                    }}
                                    className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    {['All', 'YouTube', 'Facebook', 'Telegram', 'TikTok', 'Twitter', 'Instagram', 'Custom'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Sort:</span>
                                <select 
                                    value={browseSort}
                                    onChange={(e) => {
                                        setBrowseSort(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                    }}
                                    className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    <option value="latest">⏱️ Latest</option>
                                    <option value="reward-desc">💰 Reward: High to Low</option>
                                    <option value="reward-asc">🪙 Reward: Low to High</option>
                                    <option value="quantity-desc">👥 Slots: High to Low</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredBrowseableTasks.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No active user task campaigns match your search filters. Check back soon!
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {paginatedBrowseTasks.map(task => {
                                    const alreadySubmitted = mySubmissions.some(s => s.taskId.toString() === task._id.toString());
                                    return (
                                        <div key={task._id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border dark:border-gray-700 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <Badge variant="info">{task.category} / {task.subType}</Badge>
                                                    <span className="text-emerald-500 font-black text-lg">+{task.rewardPerTask} USD</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{task.title}</h4>
                                                <p className="text-sm text-gray-500 mb-6 line-clamp-3">{task.description}</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="text-xs text-gray-400 flex justify-between">
                                                    <span>Progress: {task.currentCompletions} / {task.targetQuantity}</span>
                                                    <span>By: {task.userName}</span>
                                                </div>

                                                <div className="flex gap-2">
                                                    {alreadySubmitted ? (
                                                        <span className="w-full text-center py-3 px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl font-bold text-xs flex items-center justify-center gap-1">
                                                            ✓ Submitted
                                                        </span>
                                                    ) : (
                                                        <Button 
                                                            variant="primary" 
                                                            className="w-full py-3 text-xs font-bold"
                                                            onClick={() => {
                                                                setSelectedTaskForProof(task);
                                                                setProofStep(1); // Start at step 1 (View Details)
                                                                setProofText('');
                                                                setProofUsername('');
                                                                setProofUserIdVal('');
                                                                setProofEmail('');
                                                                setProofImage('');
                                                                setSubmittedProofsValues({});
                                                                setProofAgreed(false);
                                                            }}
                                                        >
                                                            🔍 View Detail
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {renderPagination(browsePage, totalBrowsePages, setBrowsePage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: MY CAMPAIGNS */}
            {activeTab === 'my-tasks' && (() => {
                const totalMySpent = mySubmittedTasks.reduce((acc, t) => acc + t.totalBudget, 0).toFixed(2);
                const activeCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Approved' && t.currentCompletions < t.targetQuantity).length;
                const pendingCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Pending').length;
                const completedCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Completed' || t.currentCompletions >= t.targetQuantity).length;
                const rejectedCampaignsCount = mySubmittedTasks.filter(t => t.status === 'Rejected').length;

                return (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">My Created Task Campaigns</h3>
                                <p className="text-xs text-gray-500 mt-1">Monitor your running campaigns, total budget, completion progress, and administrator approval statuses.</p>
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border dark:border-gray-700 flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Spent</span>
                                <span className="text-2xl font-black text-emerald-500 font-mono mt-1">${totalMySpent} USD</span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border dark:border-gray-700 flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">🟢 Active Campaigns</span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white mt-1">{activeCampaignsCount}</span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border dark:border-gray-700 flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">⏳ Awaiting Approval</span>
                                <span className="text-2xl font-black text-amber-500 mt-1">{pendingCampaignsCount}</span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border dark:border-gray-700 flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">🏆 Completed Campaigns</span>
                                <span className="text-2xl font-black text-blue-500 mt-1">{completedCampaignsCount}</span>
                            </div>
                        </div>

                        {/* Filter & Search Bar */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-md border dark:border-gray-700/60 flex flex-col lg:flex-row gap-4 items-center justify-between">
                            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('all');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                        myCampaignFilter === 'all'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🌍 All ({mySubmittedTasks.length})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('pending');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                        myCampaignFilter === 'pending'
                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    ⏳ Pending ({pendingCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('approved');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                        myCampaignFilter === 'approved'
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🟢 Active ({activeCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('completed');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                        myCampaignFilter === 'completed'
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    🏆 Completed ({completedCampaignsCount})
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCampaignFilter('rejected');
                                        setMyCampaignsPage(1);
                                    }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                        myCampaignFilter === 'rejected'
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    ❌ Rejected ({rejectedCampaignsCount})
                                </button>
                            </div>

                            <div className="relative w-full lg:w-72 shrink-0">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Search campaign title..."
                                    value={myCampaignsSearch}
                                    onChange={(e) => {
                                        setMyCampaignsSearch(e.target.value);
                                        setMyCampaignsPage(1);
                                    }}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>

                        {filteredMyCampaignsList.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                                No task campaigns found matching this filter.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                                    <th className="p-6">Title</th>
                                                    <th className="p-6">Category</th>
                                                    <th className="p-6">Budget (USD)</th>
                                                    <th className="p-6">Progress</th>
                                                    <th className="p-6">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                                {paginatedMyCampaigns.map(task => (
                                                    <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                        <td className="p-6 text-gray-900 dark:text-white font-bold">{task.title}</td>
                                                        <td className="p-6 text-gray-500">{task.category} ({task.subType})</td>
                                                        <td className="p-6 font-mono text-emerald-500 font-bold">{task.totalBudget} USD</td>
                                                        <td className="p-6 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                        <td className="p-6">
                                                            <div className="space-y-1">
                                                                {task.currentCompletions >= task.targetQuantity || task.status === 'Completed' ? (
                                                                    <Badge variant="success">✅ Completed</Badge>
                                                                ) : task.status === 'Approved' ? (
                                                                    <Badge variant="success">🟢 Active</Badge>
                                                                ) : task.status === 'Pending' ? (
                                                                    <Badge variant="warning">⏳ Pending Approval</Badge>
                                                                ) : task.status === 'Rejected' ? (
                                                                    <Badge variant="danger">❌ Rejected</Badge>
                                                                ) : (
                                                                    <Badge variant="danger">{task.status}</Badge>
                                                                )}
                                                                {task.status === 'Rejected' && task.adminNotes && (
                                                                    <p className="text-[10px] text-red-500 max-w-[150px] font-medium leading-tight mt-1">
                                                                        Reason: {task.adminNotes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {renderPagination(myCampaignsPage, totalMyCampaignsPages, setMyCampaignsPage)}
                            </div>
                        )}
                    </div>
                );
            })()}

             {/* TAB: PENDING PAYMENT TASKS */}
            {activeTab === 'pending-payment' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pending Payment Tasks & Proofs</h3>
                            <p className="text-xs text-gray-500 mt-1">Review proofs you have submitted that are currently awaiting review by the campaign creators or administrators.</p>
                        </div>
                        <div className="relative w-full md:w-72">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input 
                                type="text"
                                placeholder="Search pending tasks..."
                                value={pendingSearch}
                                onChange={(e) => {
                                    setPendingSearch(e.target.value);
                                    setPendingPage(1);
                                }}
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {filteredPendingSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No pending payment tasks found matching your search. Complete available tasks to await admin review.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                                <th className="p-6">Task</th>
                                                <th className="p-6">Proof Details</th>
                                                <th className="p-6">Pending Reward (USD)</th>
                                                <th className="p-6">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                            {paginatedPendingSubmissions.map(sub => (
                                                <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                    <td className="p-6 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                    <td className="p-6 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                    <td className="p-6 font-mono text-orange-500 font-bold">+{sub.rewardAmount} USD</td>
                                                    <td className="p-6">
                                                        <Badge variant="warning">Pending Admin Review & Payout</Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(pendingPage, totalPendingPages, setPendingPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: COMPLETED TASKS */}
            {activeTab === 'completed-tasks' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Completed & Rewarded Tasks</h3>
                            <p className="text-xs text-gray-500 mt-1">Inspected and approved submissions that have successfully credited your Available Task Balance.</p>
                        </div>
                        <div className="relative w-full md:w-72">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input 
                                type="text"
                                placeholder="Search completed tasks..."
                                value={completedSearch}
                                onChange={(e) => {
                                    setCompletedSearch(e.target.value);
                                    setCompletedPage(1);
                                }}
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {filteredCompletedSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No completed tasks found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                                <th className="p-6">Task</th>
                                                <th className="p-6">Proof Details</th>
                                                <th className="p-6">Paid Reward (USD)</th>
                                                <th className="p-6">Status</th>
                                                <th className="p-6">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                            {paginatedCompletedSubmissions.map(sub => (
                                                <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                    <td className="p-6 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                    <td className="p-6 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                    <td className="p-6 font-mono text-emerald-500 font-bold">+{sub.rewardAmount} USD</td>
                                                    <td className="p-6">
                                                        <Badge variant="success">Completed & Rewarded</Badge>
                                                    </td>
                                                    <td className="p-6">
                                                        <Button 
                                                            variant="secondary" 
                                                            className="text-xs py-1 px-3"
                                                            onClick={() => setSelectedSubmissionForDispute(sub)}
                                                        >
                                                            Raise Dispute
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(completedPage, totalCompletedPages, setCompletedPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: REVIEW PROOFS (CAMPAIGN OWNER REVIEW) */}
            {activeTab === 'review-proofs' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Review Worker Submissions</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                As the creator of these campaigns, you can inspect worker proofs and approve to release payments or reject them with a reason.
                            </p>
                        </div>
                        {/* Filter Sub-Tabs */}
                        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border dark:border-gray-700 w-full sm:w-auto justify-center sm:justify-start">
                                {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            setReviewFilter(status);
                                            setReviewPage(1);
                                        }}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                            reviewFilter === status
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {status} ({
                                            status === 'All' 
                                                ? campaignSubmissions.length 
                                                : campaignSubmissions.filter(s => s.status === status).length
                                        })
                                    </button>
                                ))}
                            </div>

                            <div className="relative w-full sm:w-64">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Search workers or tasks..."
                                    value={reviewSearch}
                                    onChange={(e) => {
                                        setReviewSearch(e.target.value);
                                        setReviewPage(1);
                                    }}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {filteredReviewCampaignSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No worker submissions found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                                                <th className="p-6">Task Campaign</th>
                                                <th className="p-6">Worker Name</th>
                                                <th className="p-6">Proof details</th>
                                                <th className="p-6">Cost / Reward</th>
                                                <th className="p-6">Status</th>
                                                <th className="p-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                                            {paginatedReviewSubmissions.map(sub => (
                                                <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                    <td className="p-6">
                                                        <div className="font-bold text-gray-900 dark:text-white">{sub.taskTitle || 'Engagement Task'}</div>
                                                        <div className="text-[10px] uppercase font-bold text-blue-500 mt-1">{sub.taskCategory || 'Platform'}</div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="font-bold text-gray-800 dark:text-gray-200">@{sub.workerName}</div>
                                                        <div className="text-[10px] font-mono text-gray-400">ID: {sub.workerId}</div>
                                                    </td>
                                                    <td className="p-6 text-sm text-gray-600 dark:text-gray-300">
                                                        <div className="space-y-1.5 max-w-sm">
                                                            {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {sub.submittedProofs.map((item: any, idx: number) => {
                                                                        const isImage = item.type === 'screenshot' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                                                        return (
                                                                            <div key={item.id || idx} className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl border dark:border-gray-700/60 text-xs">
                                                                                <span className="text-[10px] uppercase font-black text-blue-500 block">{item.label}</span>
                                                                                {isImage ? (
                                                                                    <div className="mt-1">
                                                                                        <div className="relative group w-20 h-20 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(item.value)}>
                                                                                            <img src={item.value} alt={item.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                                <span className="text-white text-lg font-black">🔍</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <a href={item.value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1 inline-block font-bold">Open Original</a>
                                                                                    </div>
                                                                                ) : (
                                                                                    <p className="font-medium text-gray-800 dark:text-gray-200 break-all">{item.value}</p>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {sub.proofText && (
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Text Proof</span>
                                                                            <p className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl text-xs border dark:border-gray-700 text-gray-800 dark:text-gray-200 break-all">{sub.proofText}</p>
                                                                        </div>
                                                                    )}
                                                                    {sub.proofUsername && (
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Username</span>
                                                                            <p className="font-mono text-xs text-gray-800 dark:text-gray-200">{sub.proofUsername}</p>
                                                                        </div>
                                                                    )}
                                                                    {sub.proofUserIdVal && (
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">User ID</span>
                                                                            <p className="font-mono text-xs text-gray-800 dark:text-gray-200">{sub.proofUserIdVal}</p>
                                                                        </div>
                                                                    )}
                                                                    {sub.proofEmail && (
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Email</span>
                                                                            <p className="font-mono text-xs text-gray-800 dark:text-gray-200">{sub.proofEmail}</p>
                                                                        </div>
                                                                    )}
                                                                    {sub.proofImage && (
                                                                        <div className="mt-2">
                                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Screenshot Proof</span>
                                                                            <div className="relative group w-20 h-20 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(sub.proofImage)}>
                                                                                <img src={sub.proofImage} alt="Screenshot proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                    <span className="text-white text-lg font-black">🔍</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {!sub.proofText && !sub.proofUsername && !sub.proofUserIdVal && !sub.proofEmail && !sub.proofImage && (
                                                                        <span className="text-xs italic text-gray-400">No proof details submitted</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 font-mono font-black text-emerald-500">
                                                        +{sub.rewardAmount} USD
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="space-y-1">
                                                            <Badge variant={sub.status === 'Approved' ? 'success' : sub.status === 'Pending' ? 'warning' : 'danger'}>
                                                                {sub.status}
                                                            </Badge>
                                                            {sub.status === 'Rejected' && sub.rejectionReason && (
                                                                <p className="text-[10px] text-red-500 max-w-[150px] line-clamp-2" title={sub.rejectionReason}>
                                                                    <strong>Reason:</strong> {sub.rejectionReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {sub.status === 'Pending' && (
                                                                <>
                                                                    <Button
                                                                        variant="primary"
                                                                        className="text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 border-none shadow"
                                                                        onClick={() => handleApproveSubmission(sub._id)}
                                                                    >
                                                                        Approve & Pay
                                                                    </Button>
                                                                    <Button
                                                                        variant="danger"
                                                                        className="text-xs py-1.5 px-3"
                                                                        onClick={() => handleRejectSubmission(sub._id)}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {sub.status !== 'Pending' && (
                                                                <span className="text-xs text-gray-400 italic">No actions available</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {renderPagination(reviewPage, totalReviewPages, setReviewPage)}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: CURRENCY CONVERTER & WITHDRAW */}
            {activeTab === 'converter' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl border dark:border-gray-700 max-w-2xl mx-auto space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Currency Converter & Withdrawal</h3>
                        <p className="text-sm text-gray-500">
                            Task earnings are in USD. Based on your registered country ({currentUser.country || 'Global'}), you can convert your USD balance directly into your country currency ({allowedCurrency}).
                        </p>
                    </div>

                    <form onSubmit={handleRunConversion} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-black uppercase text-gray-500">Amount (USD)</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const bal = Number((currentUser.taskWalletBalance || 0).toFixed(2));
                                            if (bal <= 0) {
                                                alert('You do not have enough amount for conversion.');
                                            } else {
                                                setConvertAmount(bal);
                                            }
                                        }}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1"
                                        title="Click to lookup and auto-fill available task balance"
                                    >
                                        🔍 Lookup: ${(currentUser.taskWalletBalance || 0).toFixed(2)} USD
                                    </button>
                                </div>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required
                                    value={convertAmount} 
                                    onChange={(e) => setConvertAmount(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">From Currency</label>
                                <input 
                                    type="text"
                                    disabled
                                    value="USD"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 mb-2">To Currency (Country Specific)</label>
                            <input 
                                type="text"
                                disabled
                                value={allowedCurrency}
                                className="w-full px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                {currentUser.country === 'Pakistan' ? 'Registered from Pakistan -> Converted to PKR.' : europeanCountries.includes(currentUser.country || '') ? 'Registered from Europe -> Converted to EUR.' : 'Converted to USD.'}
                            </p>
                        </div>

                        <Button type="submit" variant="primary" isLoading={isConverting} className="w-full py-4 text-lg">
                            Convert & Withdraw ({allowedCurrency})
                        </Button>
                    </form>

                    {conversionResult && (
                        <div className="mt-8 p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-3xl text-center space-y-2">
                            <p className="text-xs uppercase font-black text-blue-500 tracking-wider">Conversion Successful</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {(conversionResult.fromAmount ?? conversionResult.data?.fromAmount)} {(conversionResult.fromCurrency ?? conversionResult.data?.fromCurrency)} = <span className="text-emerald-500">{(conversionResult.toAmount ?? conversionResult.data?.toAmount)} {(conversionResult.toCurrency ?? conversionResult.data?.toCurrency)}</span>
                            </p>
                            <p className="text-xs text-gray-500">Converted using active platform exchange rates and credited to wallet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* PROOF SUBMISSION MODAL */}
            {selectedTaskForProof && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6 my-8">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Task: {selectedTaskForProof.title}</h3>
                            <button onClick={() => setSelectedTaskForProof(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        {/* Professional Step Indicator */}
                        <div className="flex items-center justify-between mb-6 w-full max-w-xs mx-auto relative">
                            <div className="absolute top-[15px] left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-0"></div>
                            {[
                                { step: 1, label: 'Details' },
                                { step: 2, label: 'Submit Proof' }
                            ].map((s) => {
                                const isActive = proofStep === s.step;
                                const isCompleted = proofStep > s.step;
                                return (
                                    <div key={s.step} className="flex flex-col items-center relative z-10 flex-1">
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                                                isActive 
                                                    ? 'bg-blue-600 text-white shadow-lg' 
                                                    : isCompleted 
                                                        ? 'bg-green-500 text-white' 
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600'
                                            }`}
                                        >
                                            {isCompleted ? '✓' : s.step}
                                        </div>
                                        <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider transition-colors duration-300 ${
                                            isActive 
                                                ? 'text-blue-600 dark:text-blue-400' 
                                                : isCompleted 
                                                    ? 'text-green-500' 
                                                    : 'text-gray-400'
                                        }`}>{s.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {proofStep === 1 ? (
                            /* STEP 1: DETAILS & OVERVIEW */
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700/60 text-sm">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Reward Pool</span>
                                        <span className="text-xl font-black text-emerald-500 font-mono">+{selectedTaskForProof.rewardPerTask} USD</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Platform</span>
                                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-1">
                                            {selectedTaskForProof.category} / {selectedTaskForProof.subType}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instructions &amp; Description</span>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700/60 max-h-48 overflow-y-auto">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {selectedTaskForProof.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Required Proofs to Submit</span>
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2.5">
                                        {selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0 ? (
                                            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 font-bold">
                                                {selectedTaskForProof.requiredProofs.map((req: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">{req.label}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{req.instruction || 'Please provide required input.'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 font-bold">
                                                {selectedTaskForProof.requireTextProof && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Text Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.textProofInstruction || 'Proof text or URL.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireUsername && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Username</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.usernameInstruction || 'Your profile username.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireUserId && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">User ID</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.userIdInstruction || 'Your platform unique ID.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireEmail && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Email Address</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.emailInstruction || 'Your registered email.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTaskForProof.requireScreenshot && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Screenshot Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{selectedTaskForProof.screenshotInstruction || 'Upload a screenshot image.'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-blue-500 mt-0.5">✔</span>
                                                        <div>
                                                            <span className="uppercase text-[10px] font-black text-blue-600 dark:text-blue-400 block">Confirmation Proof</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">A screenshot or verification text.</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                                    <Button type="button" variant="secondary" onClick={() => setSelectedTaskForProof(null)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                                        Close
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="primary" 
                                        className="flex-[2] py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-center"
                                        onClick={() => {
                                            if (selectedTaskForProof.link) {
                                                window.open(selectedTaskForProof.link, '_blank', 'noopener,noreferrer');
                                            }
                                            setProofStep(2);
                                        }}
                                    >
                                        Start Task &rarr;
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* STEP 2: PROOF SUBMISSION FORM */
                            <form onSubmit={handleProofSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {selectedTaskForProof.requiredProofs && Array.isArray(selectedTaskForProof.requiredProofs) && selectedTaskForProof.requiredProofs.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedTaskForProof.requiredProofs.map((req: any, index: number) => {
                                            const value = submittedProofsValues[req.id] || '';
                                            const isImage = req.type === 'screenshot';
                                            
                                            return (
                                                <div key={req.id || index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700/60 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">
                                                            Proof Requirement #{index + 1}: {req.label}
                                                        </span>
                                                        <span className="text-xs text-red-500 font-bold">* Required</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                        👉 {req.instruction}
                                                    </p>
                                                    
                                                    {isImage ? (
                                                        <div className="space-y-2.5 pt-1">
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">1. Upload Image File (PNG/JPG)</span>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*"
                                                                    onChange={(e) => handleDynamicImageUpload(req.id, e)}
                                                                    className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">2. Or Paste Image URL</span>
                                                                <input 
                                                                    type="url" 
                                                                    value={value.startsWith('data:') ? '' : value}
                                                                    onChange={(e) => setSubmittedProofsValues(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                                    placeholder="https://imgur.com/screenshot.png"
                                                                    className="w-full px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                                />
                                                            </div>

                                                            {value && (
                                                                <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2">
                                                                    <img src={value} alt="Proof preview" className="w-full h-full object-cover" />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setSubmittedProofsValues(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[req.id];
                                                                            return next;
                                                                        })}
                                                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type={req.type === 'email' ? 'email' : 'text'}
                                                            required
                                                            value={value}
                                                            onChange={(e) => setSubmittedProofsValues(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                            placeholder={`Enter your ${req.label.toLowerCase()}`}
                                                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        {/* Legacy Proof Form (for old campaigns) */}
                                        {(selectedTaskForProof.requireTextProof || (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail && !selectedTaskForProof.requireScreenshot)) && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.textProofInstruction || 'Proof Text / Comment / Link'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireTextProof}
                                                    value={proofText}
                                                    onChange={(e) => setProofText(e.target.value)}
                                                    placeholder="e.g. My Telegram/YouTube username @john_doe"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireUsername && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.usernameInstruction || 'Username'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireUsername}
                                                    value={proofUsername}
                                                    onChange={(e) => setProofUsername(e.target.value)}
                                                    placeholder="Enter your username"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireUserId && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.userIdInstruction || 'User ID'}
                                                </label>
                                                <input 
                                                    type="text" 
                                                    required={selectedTaskForProof.requireUserId}
                                                    value={proofUserIdVal}
                                                    onChange={(e) => setProofUserIdVal(e.target.value)}
                                                    placeholder="Enter your profile ID / User ID"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {selectedTaskForProof.requireEmail && (
                                            <div>
                                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">
                                                    {selectedTaskForProof.emailInstruction || 'Email'}
                                                </label>
                                                <input 
                                                    type="email" 
                                                    required={selectedTaskForProof.requireEmail}
                                                    value={proofEmail}
                                                    onChange={(e) => setProofEmail(e.target.value)}
                                                    placeholder="Enter your registered email"
                                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                                                />
                                            </div>
                                        )}

                                        {(selectedTaskForProof.requireScreenshot || (!selectedTaskForProof.requireTextProof && !selectedTaskForProof.requireUsername && !selectedTaskForProof.requireUserId && !selectedTaskForProof.requireEmail)) && (
                                            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                                                <label className="block text-xs font-black uppercase text-gray-500">
                                                    {selectedTaskForProof.screenshotInstruction || 'Screenshot / Image Proof'}
                                                </label>
                                                
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">1. Upload Image File (PNG/JPG)</span>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">2. Or Paste Image URL</span>
                                                    <input 
                                                        type="url" 
                                                        value={proofImage.startsWith('data:') ? '' : proofImage}
                                                        onChange={(e) => setProofImage(e.target.value)}
                                                        placeholder="https://imgur.com/screenshot.png"
                                                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs"
                                                    />
                                                </div>

                                                {proofImage && (
                                                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2">
                                                        <img src={proofImage} alt="Proof preview" className="w-full h-full object-cover" />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setProofImage('')}
                                                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-2">
                                        <span className="text-sm">⚠️</span>
                                        <span>
                                            <strong>Warning Notice:</strong> If you submit incorrect proof or do not complete the task properly, your account may be banned and your balance may be deducted.
                                        </span>
                                    </p>
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={proofAgreed}
                                            onChange={(e) => setProofAgreed(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            I confirm I completed the task properly and agree to the terms.
                                        </span>
                                    </label>
                                </div>

                                <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                                    <Button type="button" variant="secondary" onClick={() => setProofStep(1)} className="flex-1 py-3 text-xs font-bold uppercase tracking-wider">
                                        &larr; Back
                                    </Button>
                                    <Button type="submit" variant="primary" isLoading={isSubmittingProof} className="flex-[2] py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg">
                                        Submit Proof ✓
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* DISPUTE MODAL */}
            {selectedSubmissionForDispute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Raise Dispute: {selectedSubmissionForDispute.taskTitle}</h3>
                            <button onClick={() => setSelectedSubmissionForDispute(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-sm text-gray-600 dark:text-gray-300 space-y-2">
                            <p><strong className="text-gray-900 dark:text-white">Notice:</strong> You can file a dispute within 48 hours of task rejection. The Admin will review your proof and decide on payment release.</p>
                            <p><strong className="text-gray-900 dark:text-white">Reward at Stake:</strong> <span className="text-emerald-500 font-bold">+{selectedSubmissionForDispute.rewardAmount} USD</span></p>
                        </div>

                        <form onSubmit={handleDisputeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Dispute Description & Reason</label>
                                <textarea 
                                    rows={4}
                                    required
                                    value={disputeDescription}
                                    onChange={(e) => setDisputeDescription(e.target.value)}
                                    placeholder="Explain why this task submission was correct and should be approved (e.g. I completed all steps as requested...)"
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDispute(null)} className="flex-1 py-3">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingDispute} className="flex-1 py-3">
                                    Submit Dispute
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONVERT & TRANSFER TASK WALLET MODAL */}
            {showConvertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Task Wallet Conversion</h3>
                            <button onClick={() => setShowConvertModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Task Balance (USD):</span>
                                <span className="font-bold text-gray-900 dark:text-white">${(currentUser.taskWalletBalance || 0).toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Base Currency:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentUser.currency || 'USD'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Exchange Rate:</span>
                                <span className="font-bold text-gray-900 dark:text-white">1 USD = {rates[currentUser.currency || 'USD'] || 1} {currentUser.currency || 'USD'}</span>
                            </div>
                            <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-gray-500">Converted Amount:</span>
                                <span className="text-lg font-black text-emerald-500">
                                    {(((currentUser.taskWalletBalance || 0) * (rates[currentUser.currency || 'USD'] || 1))).toFixed(2)} {currentUser.currency || 'USD'}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            Funds will be transferred instantly to your Main MLM Balance and added to your transactions record.
                        </p>

                        <div className="flex gap-4 pt-2">
                            <Button type="button" variant="secondary" onClick={() => setShowConvertModal(false)} className="flex-1 py-3">
                                Cancel
                            </Button>
                            <Button 
                                type="button" 
                                variant="primary" 
                                isLoading={isTransferringTaskWallet} 
                                onClick={handleTransferTaskWallet}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700"
                            >
                                Instant Transfer
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREENSHOT PREVIEW OVERLAY */}
            {selectedProofImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedProofImage(null)}>
                    <div className="max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-2xl relative overflow-auto space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-900 dark:text-white">Proof Screenshot Preview</h4>
                            <button onClick={() => setSelectedProofImage(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-3xl font-black">&times;</button>
                        </div>
                        <img src={selectedProofImage} alt="Proof" className="max-w-full h-auto rounded-2xl mx-auto border dark:border-gray-700 shadow-lg" referrerPolicy="no-referrer" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTasksSubmit;
