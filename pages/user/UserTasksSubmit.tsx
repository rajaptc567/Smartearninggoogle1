import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { formatCurrency, UserTask } from '../../types';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { createUserTask, submitUserTaskProof, convertUserCurrency, createDispute, convertTaskWalletBalance, updateSubmissionStatus, openTaskDispute, updateUserTaskStatus, deleteUserTask } from '../../services/api';
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
    const [reviewFilter, setReviewFilter] = useState<'All' | 'Pending' | 'Disputed' | 'Approved' | 'Rejected'>('Pending');
    const [myCampaignFilter, setMyCampaignFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');

    // Dispute State
    const [selectedSubmissionForDispute, setSelectedSubmissionForDispute] = useState<any | null>(null);
    const [disputeDescription, setDisputeDescription] = useState('');
    const [disputeProofImage, setDisputeProofImage] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Campaign Review Resubmission State
    const [selectedCampaignForReview, setSelectedCampaignForReview] = useState<any | null>(null);
    const [reviewExplanation, setReviewExplanation] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
    const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] = useState<any | null>(null);
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
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'All' | 'Approved' | 'Rejected' | 'Pending'>('All');
    const [completedPage, setCompletedPage] = useState(1);
    const completedItemsPerPage = 10;

    // Review Proofs Search & Pagination State
    const [reviewSearch, setReviewSearch] = useState('');
    const [reviewPage, setReviewPage] = useState(1);
    const reviewItemsPerPage = 10;

    // Creator Campaign Management Detail View State
    const [selectedCampaignForDetail, setSelectedCampaignForDetail] = useState<any | null>(null);
    const [detailSubmissionTab, setDetailSubmissionTab] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [selectedSubmissions, setSelectedSubmissions] = useState<Record<string, boolean>>({});
    const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
    const [rejectionFeedback, setRejectionFeedback] = useState('');
    const [selectedWorkerSubmissionForDetails, setSelectedWorkerSubmissionForDetails] = useState<any | null>(null);
    const [copiedCampaignLink, setCopiedCampaignLink] = useState(false);

    const handleCopyCampaignLink = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedCampaignLink(true);
        setTimeout(() => setCopiedCampaignLink(false), 2000);
    };

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
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
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

    const handleDisputeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
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
                setDisputeProofImage(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleDynamicImageUpload = (proofId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || /\.(heic|heif|webp|png|jpe?g|gif|bmp|tiff?)$/i.test(file.name);
        if (!isImage) {
            alert('Please select a valid image file (PNG, JPG, WEBP, GIF, BMP, HEIC, etc.).');
            e.target.value = '';
            return;
        }
        const maxMB = settings?.proofControls?.maxScreenshotSizeMB ?? 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`File size exceeds maximum allowed limit of ${maxMB} MB.`);
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

    const config = settings.userTaskConfig || { minQuantity: 5, minRewardAmount: 0.10, commissionPercent: 10, campaignFeeEnabled: false, campaignFeeAmount: 1.00 };
    const isEnabled = settings.isUserTaskEnabled ?? true;
    const rates = settings.exchangeRates || { USD: 1, EUR: 0.92, PKR: 278 };

    // Entire setup in USD for tasks
    const subtotal = targetQuantity * rewardPerTask; // in USD
    const adminCommission = Number((subtotal * (config.commissionPercent / 100)).toFixed(2));
    const totalBudgetUSD = Number((subtotal + adminCommission).toFixed(2));
    const campaignFeeUSD = config.campaignFeeEnabled ? (config.campaignFeeAmount || 0) : 0;
    const grandTotalUSD = Number((totalBudgetUSD + campaignFeeUSD).toFixed(2));

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

    useEffect(() => {
        const { minPayout, minSlots } = getSelectionLimits();
        setTargetQuantity(minSlots);
        setRewardPerTask(minPayout);
    }, [category, subType, watchTimeTierIndex, settings]);

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

        // Convert grandTotalUSD to user currency for balance verification
        const userCurr = currentUser.currency || 'USD';
        let budgetInUserCurr = grandTotalUSD * (rates[userCurr] || 1);
        budgetInUserCurr = Number(budgetInUserCurr.toFixed(2));

        if (currentUser.walletBalance < budgetInUserCurr) {
            return alert(`Insufficient wallet balance. Total cost is ${budgetInUserCurr} ${userCurr} (${grandTotalUSD} USD: ${totalBudgetUSD} Budget + ${campaignFeeUSD} Base Fee), you have ${currentUser.walletBalance} ${userCurr}. Please convert funds or deposit.`);
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
            formData.append('description', disputeDescription || `Dispute for task submission: ${selectedSubmissionForDispute.taskTitle}`);

            if (disputeProofImage) {
                if (disputeProofImage.startsWith('data:')) {
                    const arr = disputeProofImage.split(',');
                    const mimeMatch = arr[0].match(/:(.*?);/);
                    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    formData.append('proof', blob, 'dispute_proof.jpg');
                } else {
                    formData.append('proofUrl', disputeProofImage);
                }
            }
            
            const dispute = await openTaskDispute(selectedSubmissionForDispute._id, formData);
            
            const isEscalation = selectedSubmissionForDispute.disputeStage === 'RejectedByCreator';
            const nextDisputeStage = isEscalation ? 'Escalated' : 'CreatorReview';

            // Dispatch locally so the UI updates without requiring page reload
            dispatch({
                type: 'UPDATE_USER_TASK_SUBMISSION',
                payload: {
                    ...selectedSubmissionForDispute,
                    status: 'Disputed',
                    disputeOpened: true,
                    disputeId: dispute._id,
                    disputeStage: nextDisputeStage
                }
            });

            if (isEscalation) {
                alert('Dispute successfully escalated to the Admin! The Admin will review the chat and make a final decision.');
            } else {
                const disputeReviewDays = settings?.systemLimits?.disputeReviewTimeoutDays ?? 3;
                alert(`Dispute raised successfully! The creator has been notified and has ${disputeReviewDays} days to review it.`);
            }
            setSelectedSubmissionForDispute(null);
            setDisputeDescription('');
            setDisputeProofImage('');
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

    const handleToggleCampaignStatus = async (task: any) => {
        const nextStatus = task.status === 'Approved' ? 'On Hold' : 'Approved';
        const actionLabel = nextStatus === 'On Hold' ? 'Pause' : 'Play';
        if (!window.confirm(`Are you sure you want to ${actionLabel} this campaign?`)) return;
        try {
            const updated = await updateUserTaskStatus(task._id, { status: nextStatus });
            dispatch({ type: 'UPDATE_USER_TASK', payload: updated });
            // Keep selectedCampaignForDetail in sync if currently viewing it
            if (selectedCampaignForDetail && selectedCampaignForDetail._id === task._id) {
                setSelectedCampaignForDetail(updated);
            }
            alert(`Campaign status changed to ${nextStatus === 'On Hold' ? 'Paused' : 'Active'}!`);
        } catch (error) {
            alert(`Failed to update campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleSubmitCampaignForReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCampaignForReview) return;
        setIsSubmittingReview(true);
        try {
            const res = await updateUserTaskStatus(selectedCampaignForReview._id, {
                reviewRequested: true,
                userReviewMessage: reviewExplanation
            });
            dispatch({ type: 'UPDATE_USER_TASK', payload: res.task });
            dispatch({ type: 'UPDATE_USER', payload: res.user });
            
            if (selectedCampaignForDetail && selectedCampaignForDetail._id === selectedCampaignForReview._id) {
                setSelectedCampaignForDetail(res.task);
            }

            alert("Campaign successfully submitted to Admin for one-time review!");
            setSelectedCampaignForReview(null);
            setReviewExplanation('');
        } catch (error) {
            alert(`Failed to submit for review: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDeleteCampaign = async (taskId: string): Promise<boolean> => {
        if (!window.confirm("Are you sure you want to delete this campaign? Any remaining slots budget will be refunded to your balance.")) return false;
        try {
            await deleteUserTask(taskId);
            dispatch({ type: 'DELETE_USER_TASK', payload: taskId });
            alert("Campaign deleted and remaining budget refunded successfully!");
            return true;
        } catch (error) {
            alert(`Failed to delete campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    };

    const handleBulkApprove = async (subIds: string[]) => {
        if (subIds.length === 0) return alert("No submissions selected.");
        if (!window.confirm(`Are you sure you want to approve ${subIds.length} submissions?`)) return;
        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;
        for (const id of subIds) {
            try {
                const updated = await updateSubmissionStatus(id, { status: 'Approved' });
                dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
                successCount++;
            } catch (error) {
                console.error(`Failed to approve submission ${id}:`, error);
                failCount++;
            }
        }
        setIsSubmitting(false);
        setSelectedSubmissions({});
        alert(`Bulk approval complete! ${successCount} approved, ${failCount} failed.`);
    };

    const handleBulkReject = async (subIds: string[], reason: string) => {
        if (subIds.length === 0) return alert("No submissions selected.");
        if (!reason.trim()) return alert("Rejection reason is required.");
        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;
        for (const id of subIds) {
            try {
                const updated = await updateSubmissionStatus(id, { 
                    status: 'Rejected', 
                    rejectionReason: reason,
                    adminNotes: reason
                });
                dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
                successCount++;
            } catch (error) {
                console.error(`Failed to reject submission ${id}:`, error);
                failCount++;
            }
        }
        setIsSubmitting(false);
        setRejectingSubId(null);
        setRejectionFeedback('');
        setSelectedSubmissions({});
        alert(`Bulk rejection complete! ${successCount} rejected, ${failCount} failed.`);
    };

    const handleSingleReject = async (subId: string, reason: string) => {
        if (!reason.trim()) return alert("Rejection reason is required.");
        setIsSubmitting(true);
        try {
            const updated = await updateSubmissionStatus(subId, { 
                status: 'Rejected', 
                rejectionReason: reason,
                adminNotes: reason
            });
            dispatch({ type: 'UPDATE_USER_TASK_SUBMISSION', payload: updated });
            alert("Submission rejected successfully!");
            setRejectingSubId(null);
            setRejectionFeedback('');
            // Also update local selected worker submission if open
            if (selectedWorkerSubmissionForDetails?._id === subId) {
                setSelectedWorkerSubmissionForDetails(updated);
            }
        } catch (error) {
            alert(`Failed to reject submission: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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
    const filteredCompletedSubmissions = mySubmissions
        .filter(s => {
            if (historyStatusFilter === 'All') return true;
            return s.status === historyStatusFilter;
        })
        .filter(s => {
            const titleMatch = s.taskTitle && s.taskTitle.toLowerCase().includes(completedSearch.toLowerCase());
            const proofMatch = (s.proofText && s.proofText.toLowerCase().includes(completedSearch.toLowerCase())) ||
                               (s.proofUsername && s.proofUsername.toLowerCase().includes(completedSearch.toLowerCase())) ||
                               (s.proofUserIdVal && s.proofUserIdVal.toLowerCase().includes(completedSearch.toLowerCase()));
            return completedSearch === '' || titleMatch || proofMatch;
        });

    const totalCompletedPages = Math.max(1, Math.ceil(filteredCompletedSubmissions.length / completedItemsPerPage));
    const paginatedCompletedSubmissions = filteredCompletedSubmissions.slice(
        (completedPage - 1) * completedItemsPerPage,
        completedPage * completedItemsPerPage
    );

    // 5. Review Proofs Tab Filtration & Pagination
    const filteredReviewCampaignSubmissions = campaignSubmissions
        .filter(s => {
            if (reviewFilter === 'All') return true;
            if (reviewFilter === 'Disputed') return s.status === 'Disputed';
            return s.status === reviewFilter;
        })
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
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Earn Cash & Gigs Hub Locked</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium leading-relaxed">
                        {settings.userTaskNotificationEnabled !== false 
                            ? (settings.userTaskNotificationMessage || 'Want to earn extra rewards? Activate the required investment plan to unlock the Earn Cash & Gigs Hub and start earning today!')
                            : 'Access to the Earn Cash & Gigs Hub is restricted by the administrator.'}
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
        <div className="space-y-4 md:space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="bg-[#0f172a] p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
                    <div>
                        <h1 className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight">Earn Cash & Gigs Hub (USD)</h1>
                        <p className="mt-1 text-blue-100/70 font-semibold uppercase text-[10px] md:text-xs tracking-wider ml-1">Create USD campaigns, complete tasks with proof, and convert currency</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full lg:flex lg:flex-wrap lg:w-auto">
                        {[
                            { id: 'browse', label: 'Available Tasks', count: browseableTasks.length, icon: '📋' },
                            { id: 'pending-payment', label: 'Pending Review', count: pendingSubmissions.length, icon: '⏳' },
                            { id: 'completed-tasks', label: 'Submission History', count: mySubmissions.length, icon: '📜' },
                            { id: 'submit', label: 'Create Campaign', icon: '🚀' },
                            { id: 'my-tasks', label: 'My Campaigns', count: mySubmittedTasks.length, icon: '📂' },
                            { id: 'review-proofs', label: 'Review Proofs', count: campaignSubmissions.filter(s => s.status === 'Pending').length, icon: '👁️' },
                            { id: 'converter', label: 'Converter', icon: '🔄' },
                        ].map((tab, idx) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-wider transition-all duration-300 select-none ${
                                    idx === 6 ? 'col-span-2 lg:col-span-1' : ''
                                } ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 scale-[1.02]'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
                                }`}
                            >
                                <span className="text-xs md:text-sm">{tab.icon}</span>
                                <span className="truncate">{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`ml-1 text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full ${
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
            <div className="bg-gradient-to-r from-blue-950 to-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] text-white shadow-xl flex flex-col lg:flex-row justify-between items-center gap-4 md:gap-6 border border-blue-500/15">
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row items-center sm:gap-6 w-full lg:w-auto">
                    <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                        <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 bg-blue-600/20 rounded-xl md:rounded-2xl flex items-center justify-center text-sm md:text-xl font-black text-emerald-400 border border-blue-500/30 shadow-inner">
                            💲
                        </div>
                        <div>
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-300 block leading-none mb-0.5 md:mb-1">Task Balance</span>
                            <span className="text-xs md:text-2xl font-black tracking-tight text-white block">
                                ${(currentUser.taskWalletBalance || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                        <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 bg-emerald-600/20 rounded-xl md:rounded-2xl flex items-center justify-center text-sm md:text-xl font-black text-emerald-400 border border-emerald-500/30 shadow-inner">
                            💳
                        </div>
                        <div>
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 block leading-none mb-0.5 md:mb-1">MLM Balance</span>
                            <span className="text-xs md:text-2xl font-black tracking-tight text-white block truncate">
                                {(currentUser.walletBalance || 0).toFixed(2)} {currentUser.currency || 'USD'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 w-full lg:w-auto justify-end">
                    <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Registered Currency</span>
                        <span className="text-sm font-black text-emerald-400">{currentUser.currency || 'USD'}</span>
                    </div>
                    <Button 
                        variant="primary" 
                        onClick={() => setShowConvertModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 md:px-6 md:py-3.5 rounded-xl md:rounded-2xl shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 w-full sm:w-auto justify-center text-[10px] md:text-sm"
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
                                {config.campaignFeeEnabled && (
                                    <div className="flex justify-between py-2 border-b border-gray-800">
                                        <span className="text-gray-400">Base Campaign Creation Fee</span>
                                        <span className="font-bold text-amber-400">{campaignFeeUSD.toFixed(2)} USD</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-3 text-lg font-black text-emerald-400">
                                    <span>Total Budget</span>
                                    <span>{grandTotalUSD.toFixed(2)} USD</span>
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
                                Funds will be deducted from your wallet balance in USD equivalent. When workers submit proof (screenshot, ID, or link), the campaign creator needs to approve the task and its proof. Only then will workers receive their USD rewards instantly!
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
                        <div className="grid grid-cols-2 gap-2 w-full md:flex md:items-center md:gap-4 md:w-auto">
                            <div className="flex items-center gap-1 w-full sm:w-auto">
                                <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Cat:</span>
                                <select 
                                    value={browseCategory}
                                    onChange={(e) => {
                                        setBrowseCategory(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                    }}
                                    className="w-full px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    {['All', 'YouTube', 'Facebook', 'Telegram', 'TikTok', 'Twitter', 'Instagram', 'Custom'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-1 w-full sm:w-auto">
                                <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Sort:</span>
                                <select 
                                    value={browseSort}
                                    onChange={(e) => {
                                        setBrowseSort(e.target.value);
                                        setBrowsePage(1); // Reset page on filter change
                                    }}
                                    className="w-full px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    <option value="latest">⏱️ Latest</option>
                                    <option value="reward-desc">💰 High-Low</option>
                                    <option value="reward-asc">🪙 Low-High</option>
                                    <option value="quantity-desc">👥 Slots</option>
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
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                                {paginatedBrowseTasks.map(task => {
                                    const alreadySubmitted = mySubmissions.some(s => s.taskId.toString() === task._id.toString());
                                    return (
                                        <div key={task._id} className="bg-white dark:bg-gray-800 rounded-xl md:rounded-[2rem] p-3 md:p-6 shadow-sm hover:shadow-md transition-shadow border dark:border-gray-700/60 flex flex-col justify-between">
                                            <div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-2">
                                                    <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-extrabold text-[8px] md:text-[10px] uppercase tracking-wide truncate max-w-[90px] md:max-w-none">
                                                        {task.category}
                                                    </span>
                                                    <span className="text-emerald-500 font-black text-xs md:text-base whitespace-nowrap">+{task.rewardPerTask} USD</span>
                                                </div>
                                                <h4 className="text-xs md:text-base font-bold text-gray-900 dark:text-white mb-1 line-clamp-1" title={task.title}>{task.title}</h4>
                                                <p className="text-[10px] md:text-xs text-gray-500 mb-3 line-clamp-2 md:line-clamp-3">{task.description}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-[9px] md:text-xs text-gray-400 flex flex-col gap-0.5 md:flex-row md:justify-between">
                                                    <span>Progress: {task.currentCompletions}/{task.targetQuantity}</span>
                                                    <span className="truncate max-w-[80px] md:max-w-none">By: {task.userName}</span>
                                                </div>

                                                <div className="flex gap-1.5">
                                                    {alreadySubmitted ? (
                                                        <span className="w-full text-center py-1.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg md:rounded-2xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1">
                                                            ✓ Submitted
                                                        </span>
                                                    ) : (
                                                        <Button 
                                                            variant="primary" 
                                                            className="w-full py-1.5 px-2 text-[10px] md:text-xs font-bold rounded-lg md:rounded-2xl flex items-center justify-center gap-1"
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
                                                                setShowProofModal(true);
                                                            }}
                                                        >
                                                            <span>🔍 View</span>
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

                if (selectedCampaignForDetail) {
                    const task = selectedCampaignForDetail;
                    
                    // Filter submissions belonging to this task
                    const taskSubmissions = userTaskSubmissions.filter(s => s.taskId?.toString() === task._id?.toString());
                    
                    // Group by selected tab
                    const filteredSubmissions = taskSubmissions.filter(s => {
                        if (detailSubmissionTab === 'Pending') return s.status === 'Pending';
                        if (detailSubmissionTab === 'Approved') return s.status === 'Approved' || s.status === 'Paid';
                        if (detailSubmissionTab === 'Rejected') return s.status === 'Rejected' || s.status === 'Disputed';
                        return true;
                    });

                    // Count for badges on tabs
                    const pendingCount = taskSubmissions.filter(s => s.status === 'Pending').length;
                    const approvedCount = taskSubmissions.filter(s => s.status === 'Approved' || s.status === 'Paid').length;
                    const rejectedCount = taskSubmissions.filter(s => s.status === 'Rejected' || s.status === 'Disputed').length;

                    // Bulk selection array
                    const selectedIds = Object.keys(selectedSubmissions).filter(id => selectedSubmissions[id] && filteredSubmissions.some(s => s._id === id));
                    const isAllSelected = filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedSubmissions[s._id]);

                    return (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border dark:border-gray-700 shadow-sm">
                                <div className="space-y-1">
                                    <button 
                                        onClick={() => setSelectedCampaignForDetail(null)}
                                        className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-2"
                                    >
                                        ← Back to My Campaigns
                                    </button>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        Campaign Workspace Details
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium">Manage submissions, review proofs, reward workers, or delete this campaign.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {/* Pause/Play */}
                                    {(task.status === 'Approved' || task.status === 'On Hold') && (
                                        <button
                                            onClick={() => handleToggleCampaignStatus(task)}
                                            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                                                task.status === 'Approved'
                                                    ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 dark:border-yellow-900/40'
                                                    : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40'
                                            }`}
                                        >
                                            {task.status === 'Approved' ? '⏸ Pause Campaign' : '▶ Play Campaign'}
                                        </button>
                                    )}
                                    {/* Submit for review button */}
                                    {task.status === 'Rejected' && !task.resubmittedForReview && (
                                        <button
                                            onClick={() => {
                                                setSelectedCampaignForReview(task);
                                                setReviewExplanation('');
                                            }}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10"
                                        >
                                            🔄 Submit for Review
                                        </button>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (await handleDeleteCampaign(task._id)) {
                                                setSelectedCampaignForDetail(null);
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/10"
                                    >
                                        🗑 Delete Campaign
                                    </button>
                                </div>
                            </div>

                            {/* Campaign Info Grid (Dual-Panel Bento Layout) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Panel: Identity, URL Access & Core Instructions (Col span 2) */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-md text-xs">📋</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400">Campaign Details & Directives</h4>
                                        </div>

                                        <div className="space-y-3.5">
                                            {/* Campaign Title */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Campaign Title</span>
                                                <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5 break-words">{task.title}</h4>
                                            </div>

                                            {/* Target URL with Visiting & Copying Actions */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Campaign Landing URL / Target Link</span>
                                                    <span 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="text-[10px] font-black text-blue-500 hover:underline cursor-pointer"
                                                    >
                                                        {copiedCampaignLink ? '✅ Copied!' : '📋 Copy URL'}
                                                    </span>
                                                </div>
                                                <p className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold break-all select-all">{task.link}</p>
                                                <div className="mt-2.5 flex gap-2">
                                                    <a 
                                                        href={task.link} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-xl text-xs font-bold transition-all"
                                                    >
                                                        🚀 Visit Landing Page
                                                    </a>
                                                    <button 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700 dark:border-gray-600 rounded-xl text-xs font-bold transition-all"
                                                    >
                                                        📋 {copiedCampaignLink ? 'Link Copied!' : 'Copy to Clipboard'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Complete Instructions & Description */}
                                            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/40">
                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instructions to Workers</span>
                                                <div className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-2">
                                                    {task.description || 'No specific instructions provided.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Budgets, Slots, Status & Proof Criteria */}
                                <div className="space-y-4">
                                    {/* Financials & Progress Box */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-md text-xs">💸</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 font-mono">Financials & Slots</h4>
                                        </div>

                                        <div className="space-y-3 text-xs font-bold">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 text-[10px] block font-medium uppercase">Rate Per Task</span>
                                                    <p className="font-black text-emerald-500 font-mono text-sm mt-0.5">+{task.rewardPerTask} USD</p>
                                                </div>
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 text-[10px] block font-medium uppercase">Total Budget</span>
                                                    <p className="font-bold text-gray-900 dark:text-white font-mono text-sm mt-0.5">${task.totalBudget} USD</p>
                                                </div>
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 text-[10px] block font-medium uppercase">Completed slots</span>
                                                    <p className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm mt-0.5">{task.currentCompletions} / {task.targetQuantity}</p>
                                                </div>
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 text-[10px] block font-medium uppercase">Campaign Type</span>
                                                    <p className="text-gray-900 dark:text-white mt-0.5">{task.category} ({task.subType})</p>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t dark:border-gray-700 flex justify-between items-center text-xs">
                                                <span className="text-gray-400 font-medium uppercase text-[10px]">Campaign Status</span>
                                                <div>
                                                    {task.status === 'Approved' ? (
                                                        <Badge variant="success">🟢 Active</Badge>
                                                    ) : task.status === 'On Hold' ? (
                                                        <Badge variant="warning">⏸ Paused</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">{task.status}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Proof Requirements Criteria */}
                                    <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="p-1 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 rounded-md text-xs">🔒</span>
                                            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400">Required Proof Criteria</h4>
                                        </div>

                                        <div className="space-y-3.5 text-xs">
                                            {/* Screenshot Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireScreenshot ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    {task.requireScreenshot ? '📸' : '📷'}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Screenshot Proof
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireScreenshot ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireScreenshot ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireScreenshot && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.screenshotInstruction || 'Please upload screenshot proof of completion.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Text Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireTextProof ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    ✍
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Text Answer / Code
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireTextProof ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireTextProof ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireTextProof && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.textProofInstruction || 'Please enter confirmation text.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Username Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireUsername ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    👤
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Worker Username
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireUsername ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireUsername ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireUsername && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.usernameInstruction || 'Please provide your account username.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* User ID Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireUserId ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    🆔
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Platform User ID
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireUserId ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireUserId ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireUserId && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.userIdInstruction || 'Please provide your profile ID.'}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Email Proof */}
                                            <div className="flex items-start gap-2.5">
                                                <span className={`text-base ${task.requireEmail ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    ✉
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        Email Address
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${task.requireEmail ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-900/60'}`}>
                                                            {task.requireEmail ? 'Required' : 'Disabled'}
                                                        </span>
                                                    </p>
                                                    {task.requireEmail && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{task.emailInstruction || 'Please provide email address.'}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submissions Manager */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="p-6 border-b dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h4 className="font-black text-sm uppercase text-gray-900 dark:text-white tracking-tight">Worker Task Submissions</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Click any worker row to inspect detailed screenshot and text proof, then approve/reject.</p>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border dark:border-gray-700">
                                        {(['Pending', 'Approved', 'Rejected'] as const).map(tab => {
                                            const count = tab === 'Pending' ? pendingCount : tab === 'Approved' ? approvedCount : rejectedCount;
                                            return (
                                                <button
                                                    key={tab}
                                                    onClick={() => {
                                                        setDetailSubmissionTab(tab);
                                                        setSelectedSubmissions({});
                                                    }}
                                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                                        detailSubmissionTab === tab
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {tab === 'Pending' ? '⏳' : tab === 'Approved' ? '✅' : '❌'} {tab} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bulk Action Bar if items are selected */}
                                {selectedIds.length > 0 && detailSubmissionTab === 'Pending' && (
                                    <div className="bg-blue-50 dark:bg-blue-950/40 border-b dark:border-blue-900/50 p-4 flex justify-between items-center animate-in slide-in-from-top duration-200">
                                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                                            Selected <strong className="font-black">{selectedIds.length}</strong> submission(s)
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleBulkApprove(selectedIds)}
                                                className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-600/10"
                                            >
                                                ✔ Bulk Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRejectingSubId('bulk');
                                                    setRejectionFeedback('');
                                                }}
                                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                            >
                                                ✖ Bulk Reject
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Submissions list */}
                                {filteredSubmissions.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500 font-medium text-xs">
                                        No {detailSubmissionTab.toLowerCase()} submissions found for this campaign.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 dark:bg-gray-900/30 text-gray-400 uppercase text-[10px] tracking-wider border-b dark:border-gray-700">
                                                    {detailSubmissionTab === 'Pending' && (
                                                        <th className="p-4 w-12 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllSelected}
                                                                onChange={(e) => {
                                                                    const val = e.target.checked;
                                                                    const updated = { ...selectedSubmissions };
                                                                    filteredSubmissions.forEach(s => {
                                                                        updated[s._id] = val;
                                                                    });
                                                                    setSelectedSubmissions(updated);
                                                                }}
                                                                className="rounded border-gray-300 dark:border-gray-700 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                            />
                                                        </th>
                                                    )}
                                                    <th className="p-4 w-16 text-center"># Sequence</th>
                                                    <th className="p-4">Worker Name</th>
                                                    <th className="p-4">Submitted At</th>
                                                    <th className="p-4">Submission Status</th>
                                                    <th className="p-4 text-right">Action Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium animate-in fade-in duration-200">
                                                {filteredSubmissions.map((sub, idx) => (
                                                    <tr 
                                                        key={sub._id} 
                                                        onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 cursor-pointer transition-colors"
                                                    >
                                                        {detailSubmissionTab === 'Pending' && (
                                                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!selectedSubmissions[sub._id]}
                                                                    onChange={(e) => {
                                                                        setSelectedSubmissions({
                                                                            ...selectedSubmissions,
                                                                            [sub._id]: e.target.checked
                                                                        });
                                                                    }}
                                                                    className="rounded border-gray-300 dark:border-gray-700 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="p-4 font-mono font-bold text-gray-400 text-center">{idx + 1}</td>
                                                        <td className="p-4 text-gray-900 dark:text-white font-bold">{sub.workerName}</td>
                                                        <td className="p-4 text-gray-500 text-xs">{new Date(sub.createdAt).toLocaleString()}</td>
                                                        <td className="p-4">
                                                            {sub.status === 'Approved' || sub.status === 'Paid' ? (
                                                                <Badge variant="success">Approved</Badge>
                                                            ) : sub.status === 'Pending' ? (
                                                                <Badge variant="warning">Pending Review</Badge>
                                                            ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                                <Badge variant="info">Disputed</Badge>
                                                            ) : (
                                                                <Badge variant="danger">Rejected</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-end gap-2">
                                                                {sub.status === 'Pending' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApproveSubmission(sub._id)}
                                                                            className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                        >
                                                                            ✔ Accept
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setRejectingSubId(sub._id);
                                                                                setRejectionFeedback('');
                                                                            }}
                                                                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                        >
                                                                            ✖ Reject
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                                                >
                                                                    👁 View Detail
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

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
                                                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                    <th className="p-3.5 md:p-5">Title</th>
                                                    <th className="p-3.5 md:p-5">Category</th>
                                                    <th className="p-3.5 md:p-5">Budget (USD)</th>
                                                    <th className="p-3.5 md:p-5">Progress</th>
                                                    <th className="p-3.5 md:p-5">Status</th>
                                                    <th className="p-3.5 md:p-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                                {paginatedMyCampaigns.map(task => (
                                                    <tr key={task._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20">
                                                        <td className="p-3.5 md:p-5 text-gray-900 dark:text-white font-bold">{task.title}</td>
                                                        <td className="p-3.5 md:p-5 text-gray-500">{task.category} ({task.subType})</td>
                                                        <td className="p-3.5 md:p-5 font-mono text-emerald-500 font-bold">{task.totalBudget} USD</td>
                                                        <td className="p-3.5 md:p-5 text-gray-500">{task.currentCompletions} / {task.targetQuantity}</td>
                                                        <td className="p-3.5 md:p-5">
                                                            <div className="space-y-1">
                                                                {task.currentCompletions >= task.targetQuantity || task.status === 'Completed' ? (
                                                                    <Badge variant="success">✅ Completed</Badge>
                                                                ) : task.status === 'Approved' ? (
                                                                    <Badge variant="success">🟢 Active</Badge>
                                                                ) : task.status === 'On Hold' ? (
                                                                    <Badge variant="warning">⏸ Paused</Badge>
                                                                ) : task.status === 'Pending' ? (
                                                                    task.reviewRequested ? (
                                                                        <Badge variant="warning">🔄 Under Review</Badge>
                                                                    ) : (
                                                                        <Badge variant="warning">⏳ Pending Approval</Badge>
                                                                    )
                                                                ) : task.status === 'Rejected' ? (
                                                                    <div className="flex flex-col gap-1 items-start">
                                                                        <Badge variant="danger">❌ Rejected</Badge>
                                                                        {task.resubmittedForReview ? (
                                                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Review Closed</span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">Review Eligible</span>
                                                                        )}
                                                                    </div>
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
                                                        <td className="p-3.5 md:p-5 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {/* Pause / Play Button */}
                                                                {(task.status === 'Approved' || task.status === 'On Hold') && (
                                                                    <button
                                                                        onClick={() => handleToggleCampaignStatus(task)}
                                                                        title={task.status === 'Approved' ? "Pause Campaign" : "Resume/Play Campaign"}
                                                                        className={`p-1.5 md:p-2 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center ${
                                                                            task.status === 'Approved'
                                                                                ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 dark:border-yellow-900/40 dark:text-yellow-400'
                                                                                : 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 dark:text-green-400'
                                                                        }`}
                                                                    >
                                                                        {task.status === 'Approved' ? '⏸ Pause' : '▶ Play'}
                                                                    </button>
                                                                )}

                                                                {/* Submit for Review Button */}
                                                                {task.status === 'Rejected' && !task.resubmittedForReview && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedCampaignForReview(task);
                                                                            setReviewExplanation('');
                                                                        }}
                                                                        title="Submit Campaign for Admin Review"
                                                                        className="p-1.5 md:p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 dark:border-indigo-900/40 dark:text-indigo-400 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    >
                                                                        🔄 Review
                                                                    </button>
                                                                )}

                                                                {/* Detail Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCampaignForDetail(task);
                                                                        setDetailSubmissionTab('Pending');
                                                                        setSelectedSubmissions({});
                                                                    }}
                                                                    title="Campaign Workspace Details"
                                                                    className="p-1.5 md:p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 dark:text-blue-400 transition-all text-xs font-bold uppercase tracking-wider"
                                                                >
                                                                    👁 Detail
                                                                </button>

                                                                {/* Delete Button */}
                                                                <button
                                                                    onClick={() => handleDeleteCampaign(task._id)}
                                                                    title="Delete Campaign"
                                                                    className="p-1.5 md:p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 dark:text-red-400 transition-all text-xs font-bold uppercase tracking-wider"
                                                                >
                                                                    🗑 Delete
                                                                </button>
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
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Pending Review Tasks & Proofs</h3>
                            <p className="text-xs text-gray-500 mt-1">Review proofs you have submitted that are currently awaiting review by the campaign creators.</p>
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
                            No pending tasks found matching your search. Complete available tasks to await campaign creator review.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task</th>
                                                <th className="p-3.5 md:p-5">Proof Details</th>
                                                <th className="p-3.5 md:p-5">Pending Reward (USD)</th>
                                                <th className="p-3.5 md:p-5">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedPendingSubmissions.map(sub => (
                                                <tr 
                                                    key={sub._id} 
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedSubmissionForDetails(sub)}
                                                    title="Click to view details"
                                                >
                                                    <td className="p-3.5 md:p-5 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                    <td className="p-3.5 md:p-5 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                    <td className="p-3.5 md:p-5 font-mono text-orange-500 font-bold">+{sub.rewardAmount} USD</td>
                                                    <td className="p-3.5 md:p-5">
                                                        <Badge variant="warning">Pending</Badge>
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[2rem] shadow-md border dark:border-gray-700/60 animate-transition">
                        <div>
                            <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Submission History</h3>
                            <p className="text-xs text-gray-500 mt-1">View all your task submissions, check their review status, and view details.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full sm:w-60">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                <input 
                                    type="text"
                                    placeholder="Search by title or proof..."
                                    value={completedSearch}
                                    onChange={(e) => {
                                        setCompletedSearch(e.target.value);
                                        setCompletedPage(1);
                                    }}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                                <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">Status:</span>
                                <select 
                                    value={historyStatusFilter}
                                    onChange={(e) => {
                                        setHistoryStatusFilter(e.target.value as any);
                                        setCompletedPage(1);
                                    }}
                                    className="w-full sm:w-auto px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 dark:text-gray-200"
                                >
                                    <option value="All">🌐 All History</option>
                                    <option value="Approved">✅ Completed</option>
                                    <option value="Pending">⏳ Pending</option>
                                    <option value="Rejected">❌ Rejected</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredCompletedSubmissions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center text-gray-500 shadow-xl border dark:border-gray-700 font-medium">
                            No submissions found matching your search and status filters.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border dark:border-gray-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task</th>
                                                <th className="p-3.5 md:p-5">Proof Details</th>
                                                <th className="p-3.5 md:p-5">Reward (USD)</th>
                                                <th className="p-3.5 md:p-5">Status</th>
                                                <th className="p-3.5 md:p-5">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedCompletedSubmissions.map(sub => (
                                                <tr 
                                                    key={sub._id} 
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedSubmissionForDetails(sub)}
                                                    title="Click to view details"
                                                >
                                                    <td className="p-3.5 md:p-5 text-gray-900 dark:text-white font-bold">{sub.taskTitle || 'Engagement Task'}</td>
                                                    <td className="p-3.5 md:p-5 text-gray-500 max-w-xs truncate">{sub.proofText || sub.proofImage || 'Screenshot Uploaded'}</td>
                                                    <td className={`p-3.5 md:p-5 font-mono font-bold ${
                                                        sub.status === 'Approved' ? 'text-emerald-500' :
                                                        sub.status === 'Rejected' ? 'text-red-500 line-through opacity-60' :
                                                        'text-orange-500'
                                                    }`}>
                                                        +{sub.rewardAmount} USD
                                                    </td>
                                                    <td className="p-3.5 md:p-5">
                                                        {sub.status === 'Approved' ? (
                                                            <Badge variant="success">Completed</Badge>
                                                        ) : sub.status === 'Pending' ? (
                                                            <Badge variant="warning">Pending</Badge>
                                                        ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                            <Badge variant="info">Disputed</Badge>
                                                        ) : sub.status === 'Rejected' ? (
                                                            <Badge variant="danger">Rejected</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">{sub.status}</Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 md:p-5" onClick={(e) => e.stopPropagation()}>
                                                        {sub.status === 'Rejected' ? (
                                                            (() => {
                                                                const isLevel2 = sub.disputeStage === 'RejectedByCreator';
                                                                const isDeadlineExpired = isLevel2 
                                                                    ? (sub.secondDisputeDeadline ? new Date() > new Date(sub.secondDisputeDeadline) : false)
                                                                    : (sub.disputeDeadline ? new Date() > new Date(sub.disputeDeadline) : false);
                                                                
                                                                if (sub.disputeOpened) {
                                                                    return <span className="text-[10px] md:text-xs font-bold text-blue-500 uppercase tracking-wider">Disputed</span>;
                                                                }
                                                                if (isDeadlineExpired) {
                                                                    const limitHours = isLevel2 
                                                                        ? (settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48)
                                                                        : (settings?.systemLimits?.disputeTimeLimitHours ?? 48);
                                                                    return <span className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expired ({limitHours}h)</span>;
                                                                }
                                                                return (
                                                                    <Button 
                                                                        variant="secondary" 
                                                                        className="text-[10px] md:text-xs py-1.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold uppercase tracking-wider"
                                                                        onClick={() => {
                                                                            setSelectedSubmissionForDispute(sub);
                                                                            setDisputeDescription('');
                                                                            setDisputeProofImage('');
                                                                        }}
                                                                    >
                                                                        {isLevel2 ? 'Escalate to Admin' : 'Raise Dispute'}
                                                                    </Button>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="text-gray-400 dark:text-gray-600 font-bold text-xs">—</span>
                                                        )}
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
                                {(['All', 'Pending', 'Disputed', 'Approved', 'Rejected'] as const).map(status => (
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
                                                : status === 'Disputed'
                                                    ? campaignSubmissions.filter(s => s.status === 'Disputed').length
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
                                            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-400 uppercase text-[10px] md:text-xs tracking-wider">
                                                <th className="p-3.5 md:p-5">Task Campaign</th>
                                                <th className="p-3.5 md:p-5">Worker Name</th>
                                                <th className="p-3.5 md:p-5">Proof details</th>
                                                <th className="p-3.5 md:p-5">Cost / Reward</th>
                                                <th className="p-3.5 md:p-5">Status</th>
                                                <th className="p-3.5 md:p-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs md:text-sm font-medium">
                                            {paginatedReviewSubmissions.map(sub => (
                                                <tr 
                                                    key={sub._id} 
                                                    onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3.5 md:p-5">
                                                        <div className="font-bold text-gray-900 dark:text-white">{sub.taskTitle || 'Engagement Task'}</div>
                                                        <div className="text-[10px] uppercase font-bold text-blue-500 mt-1">{sub.taskCategory || 'Platform'}</div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5">
                                                        <div className="font-bold text-gray-800 dark:text-gray-200">@{sub.workerName}</div>
                                                        <div className="text-[10px] font-mono text-gray-400">ID: {sub.workerId}</div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5 text-sm text-gray-600 dark:text-gray-300">
                                                        <div className="flex flex-col gap-1 max-w-xs">
                                                            {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {sub.submittedProofs.map((item: any, idx: number) => {
                                                                        const isImg = item.type === 'screenshot' || item.type === 'file' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                                                        return (
                                                                            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                                {isImg ? '📸' : '✍'} {item.label}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {sub.proofText && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            ✍ Text Answer
                                                                        </span>
                                                                    )}
                                                                    {sub.proofUsername && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            👤 @{sub.proofUsername}
                                                                        </span>
                                                                    )}
                                                                    {sub.proofUserIdVal && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm font-mono">
                                                                            🆔 ID: {sub.proofUserIdVal}
                                                                        </span>
                                                                    )}
                                                                    {sub.proofEmail && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            ✉ Email
                                                                        </span>
                                                                    )}
                                                                    {sub.proofImage && (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-[10px] font-bold text-gray-600 dark:text-gray-300 border dark:border-gray-700/60 shadow-sm">
                                                                            📸 Screenshot
                                                                        </span>
                                                                    )}
                                                                    {!sub.proofText && !sub.proofUsername && !sub.proofUserIdVal && !sub.proofEmail && !sub.proofImage && (
                                                                        <span className="text-xs italic text-gray-400">No proofs submitted</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-0.5 mt-1">
                                                                🔍 Click to inspect proofs & files
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 md:p-5 font-mono font-black text-emerald-500">
                                                        +{sub.rewardAmount} USD
                                                    </td>
                                                    <td className="p-3.5 md:p-5" onClick={(e) => e.stopPropagation()}>
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
                                                    <td className="p-3.5 md:p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setSelectedWorkerSubmissionForDetails(sub)}
                                                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 dark:border-blue-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                            >
                                                                👁 Detail
                                                            </button>
                                                            {(sub.status === 'Pending' || (sub.status === 'Disputed' && sub.disputeStage === 'CreatorReview')) && (
                                                                <>
                                                                    <button
                                                                        className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 dark:bg-green-950/20 dark:hover:bg-green-900/30 dark:border-green-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        onClick={() => handleApproveSubmission(sub._id)}
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:border-red-900/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                                                        onClick={() => {
                                                                            setRejectingSubId(sub._id);
                                                                            setRejectionFeedback('');
                                                                        }}
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </>
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

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-xs text-gray-600 dark:text-gray-300 space-y-2">
                            <p id="submission-timeline-notice" className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/30 shadow-sm">
                                <strong className="text-blue-900 dark:text-blue-300 font-extrabold uppercase tracking-wider block mb-1">⏱️ Proof Submission & Dispute Rules</strong>
                                When a worker submits proof, the creator has <strong className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">{settings?.systemLimits?.approvalTimeoutDays ?? 3} days</strong> to review it. If left unreviewed, it will be auto-approved. If rejected, you have <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono">{settings?.systemLimits?.disputeTimeLimitHours ?? 48} hours</strong> to raise a dispute. The creator then has <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono">{settings?.systemLimits?.disputeReviewTimeoutDays ?? 3} days</strong> to review and resolve the dispute. If they reject your dispute, you can escalate it directly to the Admin within <strong className="text-rose-600 dark:text-rose-400 font-extrabold font-mono">{settings?.systemLimits?.secondDisputeTimeLimitHours ?? 48} hours</strong>.
                            </p>
                            <p><strong className="text-gray-900 dark:text-white">Escrow & Booking:</strong> Upon submitting this dispute, the campaign creator's funds for this task are held in escrow, and your spot will remain locked/booked. No other worker can take your slot while the dispute is pending.</p>
                            <p><strong className="text-gray-900 dark:text-white">Reward at Stake:</strong> <span className="text-emerald-500 font-bold">+{selectedSubmissionForDispute.rewardAmount} USD</span></p>
                        </div>

                        <form onSubmit={handleDisputeSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Dispute Description & Reason</label>
                                <textarea 
                                    rows={3}
                                    required
                                    value={disputeDescription}
                                    onChange={(e) => setDisputeDescription(e.target.value)}
                                    placeholder="Explain why your task submission was correct and should be approved. Provide detailed context..."
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                ></textarea>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-black uppercase text-gray-500">Attach Screenshot / Image Proof</label>
                                
                                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">1. Upload Image (PNG/JPG/WEBP)</span>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleDisputeImageUpload}
                                            className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">2. Or Paste Image URL</span>
                                        <input 
                                            type="url" 
                                            value={disputeProofImage.startsWith('data:') ? '' : disputeProofImage}
                                            onChange={(e) => setDisputeProofImage(e.target.value)}
                                            placeholder="https://imgur.com/screenshot.png"
                                            className="w-full px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    {disputeProofImage && (
                                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border shadow-sm mt-2 bg-white dark:bg-gray-800">
                                            <img src={disputeProofImage} alt="Dispute preview" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => setDisputeProofImage('')}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDispute(null)} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingDispute} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Submit Dispute
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CAMPAIGN REVIEW RESUBMISSION MODAL */}
            {selectedCampaignForReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border dark:border-gray-700 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Submit for One-Time Review</h3>
                            <button onClick={() => setSelectedCampaignForReview(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                        </div>

                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-xs text-amber-800 dark:text-amber-400 space-y-2">
                            <p className="font-bold">⚠️ Review Submission Guidelines:</p>
                            <p>You are requesting a <strong>one-time, final review</strong> from the Admin for this campaign. Please ensure you have fixed any issues reported in the rejection reason below.</p>
                            <p>Upon resubmitting, the budget of <strong className="text-emerald-500">{(selectedCampaignForReview.totalBudget + (settings.userTaskConfig?.campaignFeeEnabled ? (settings.userTaskConfig?.campaignFeeAmount || 0) : 0)).toFixed(2)} USD</strong> {(settings.userTaskConfig?.campaignFeeEnabled && (settings.userTaskConfig?.campaignFeeAmount || 0) > 0) ? `(including a ${settings.userTaskConfig?.campaignFeeAmount.toFixed(2)} USD campaign creation fee)` : ''} will be deducted from your wallet to fund the active slots. If the Admin rejects the campaign again, this entire deducted amount (Base Fee + Budget) will be fully refunded to your balance.</p>
                        </div>

                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-xs space-y-1">
                            <p className="font-bold text-red-700 dark:text-red-400">Previous Rejection Reason:</p>
                            <p className="text-gray-700 dark:text-gray-300 italic font-medium">"{selectedCampaignForReview.adminNotes || 'No specific reason provided'}"</p>
                        </div>

                        <form onSubmit={handleSubmitCampaignForReview} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Message to Admin (Your explanation / proof of correction)</label>
                                <textarea 
                                    rows={4}
                                    required
                                    value={reviewExplanation}
                                    onChange={(e) => setReviewExplanation(e.target.value)}
                                    placeholder="Explain how you fixed the issue, or provide additional notes for the Admin to approve your campaign..."
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedCampaignForReview(null)} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSubmittingReview} className="flex-1 py-3 text-xs font-bold uppercase">
                                    Send to Admin
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

            {/* SUBMISSION DETAILS MODAL */}
            {selectedSubmissionForDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border dark:border-gray-700/60 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center pb-4 border-b dark:border-gray-700">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Submission Details</h3>
                                <p className="text-[10px] text-gray-500 font-mono">ID: {selectedSubmissionForDetails._id}</p>
                            </div>
                            <button onClick={() => setSelectedSubmissionForDetails(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold text-2xl">&times;</button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                            {/* Task Info Section */}
                            <div>
                                <span className="text-[10px] uppercase font-black text-blue-500 block">Task Title</span>
                                <h4 className="text-base font-bold text-gray-900 dark:text-white">{selectedSubmissionForDetails.taskTitle || 'Engagement Task'}</h4>
                                <span className="text-xs text-gray-400">Category: {selectedSubmissionForDetails.taskCategory || 'Platform'}</span>
                            </div>

                            {/* Status and Payment Information */}
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border dark:border-gray-700 space-y-3">
                                <h5 className="text-xs uppercase font-black text-gray-500">Payment & Status Details</h5>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Status</span>
                                        <Badge variant={selectedSubmissionForDetails.status === 'Approved' ? 'success' : selectedSubmissionForDetails.status === 'Pending' ? 'warning' : 'danger'}>
                                            {selectedSubmissionForDetails.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Reward Amount</span>
                                        <span className="font-mono font-bold text-emerald-500 text-sm">+{selectedSubmissionForDetails.rewardAmount} USD</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Submitted On</span>
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                                            {selectedSubmissionForDetails.createdAt ? new Date(selectedSubmissionForDetails.createdAt).toLocaleString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Wallet Destination</span>
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">Available Task Balance</span>
                                    </div>
                                </div>

                                {selectedSubmissionForDetails.status === 'Approved' && (
                                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        🎉 Payment of +${selectedSubmissionForDetails.rewardAmount} USD was fully credited to your Available Task Balance. You can convert and transfer it to your Main MLM balance at any time!
                                    </div>
                                )}

                                {selectedSubmissionForDetails.status === 'Pending' && (
                                    <div className="text-[11px] text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        ⏳ The campaign creator is currently reviewing your proofs. Payout will occur instantly upon approval.
                                    </div>
                                )}

                                {selectedSubmissionForDetails.status === 'Rejected' && (
                                    <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 p-2.5 rounded-xl font-medium mt-1">
                                        ❌ This submission was rejected.
                                        {selectedSubmissionForDetails.rejectionReason && (
                                            <p className="mt-1 font-bold">Reason: {selectedSubmissionForDetails.rejectionReason}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Submitted Proofs Section */}
                            <div className="space-y-2">
                                <h5 className="text-xs uppercase font-black text-gray-500">Your Submitted Proofs</h5>
                                {selectedSubmissionForDetails.submittedProofs && Array.isArray(selectedSubmissionForDetails.submittedProofs) && selectedSubmissionForDetails.submittedProofs.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedSubmissionForDetails.submittedProofs.map((item: any, idx: number) => {
                                            const isImage = item.type === 'screenshot' || (item.value && (item.value.startsWith('data:') || item.value.startsWith('http')));
                                            return (
                                                <div key={item.id || idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700/60">
                                                    <span className="text-[10px] uppercase font-bold text-blue-500 block">{item.label}</span>
                                                    {isImage ? (
                                                        <div className="mt-2">
                                                            <div className="relative group w-24 h-24 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(item.value)}>
                                                                <img src={item.value} alt={item.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <span className="text-white text-lg">🔍</span>
                                                                </div>
                                                            </div>
                                                            <a href={item.value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Original Screenshot</a>
                                                        </div>
                                                    ) : (
                                                        <p className="font-medium text-xs text-gray-800 dark:text-gray-200 mt-1 break-all">{item.value}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedSubmissionForDetails.proofText && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Text Proof</span>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 break-all">{selectedSubmissionForDetails.proofText}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofUsername && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Username</span>
                                                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofUsername}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofUserIdVal && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">User ID</span>
                                                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofUserIdVal}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofEmail && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Email Address</span>
                                                <p className="text-xs text-gray-800 dark:text-gray-200 mt-1">{selectedSubmissionForDetails.proofEmail}</p>
                                            </div>
                                        )}
                                        {selectedSubmissionForDetails.proofImage && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Screenshot Proof</span>
                                                <div className="mt-2">
                                                    <div className="relative group w-24 h-24 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(selectedSubmissionForDetails.proofImage)}>
                                                        <img src={selectedSubmissionForDetails.proofImage} alt="Screenshot Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <span className="text-white text-lg">🔍</span>
                                                        </div>
                                                    </div>
                                                    <a href={selectedSubmissionForDetails.proofImage} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Original Screenshot</a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700 flex justify-end">
                            <Button type="button" variant="secondary" onClick={() => setSelectedSubmissionForDetails(null)} className="px-5 py-2">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Rejection Reason Feedback */}
            {rejectingSubId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {rejectingSubId === 'bulk' ? 'Bulk Reject Submissions' : 'Reject Proof Submission'}
                                </h4>
                                <button 
                                    onClick={() => setRejectingSubId(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl"
                                >
                                    &times;
                                </button>
                            </div>

                            <p className="text-xs text-gray-500 font-medium">
                                Please provide a detailed rejection reason. This reason will be instantly visible to the workers on their tasks history dashboard so they know why their proof was rejected.
                            </p>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Rejection Reason / Feedback</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="e.g. Invalid/unclear screenshot proof or incorrect username provided."
                                    value={rejectionFeedback}
                                    onChange={(e) => setRejectionFeedback(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={() => {
                                        setRejectingSubId(null);
                                        setRejectionFeedback('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <button
                                    type="button"
                                    disabled={isSubmitting || !rejectionFeedback.trim()}
                                    onClick={() => {
                                        if (rejectingSubId === 'bulk') {
                                            const filteredSubmissions = userTaskSubmissions.filter(s => s.taskId?.toString() === selectedCampaignForDetail?._id?.toString() && s.status === 'Pending');
                                            const selectedIds = Object.keys(selectedSubmissions).filter(id => selectedSubmissions[id] && filteredSubmissions.some(s => s._id === id));
                                            handleBulkReject(selectedIds, rejectionFeedback);
                                        } else {
                                            handleSingleReject(rejectingSubId, rejectionFeedback);
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                >
                                    {isSubmitting ? 'Rejecting...' : 'Reject & Notify'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Detailed Worker Submission Viewer */}
            {selectedWorkerSubmissionForDetails && (() => {
                const sub = selectedWorkerSubmissionForDetails;
                const task = selectedCampaignForDetail || mySubmittedTasks.find(t => t._id?.toString() === sub.taskId?.toString());
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border dark:border-gray-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                                <div>
                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block font-mono">Verification Workspace</span>
                                    <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-0.5">Worker: {sub.workerName}</h4>
                                </div>
                                <button 
                                    onClick={() => setSelectedWorkerSubmissionForDetails(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl font-bold"
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Main Body - Split Layout */}
                            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs md:text-sm font-medium">
                                
                                {/* LEFT COLUMN: Campaign Guidelines Reference */}
                                <div className="space-y-4 border-b md:border-b-0 md:border-r dark:border-gray-700 pb-5 md:pb-0 md:pr-6">
                                    <div className="flex items-center gap-1.5">
                                        <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl text-xs">📋</span>
                                        <h5 className="font-black text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400">Campaign Reference Guidelines</h5>
                                    </div>

                                    {task ? (
                                        <div className="space-y-3.5 pt-1">
                                            {/* Campaign Title & Type */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold">Campaign Title</span>
                                                <p className="font-bold text-gray-900 dark:text-white mt-0.5 break-words">{task.title}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold mt-1">Category: {task.category} ({task.subType})</p>
                                            </div>

                                            {/* Target URL */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="text-gray-400 text-[10px] uppercase font-bold">Campaign URL</span>
                                                    <span 
                                                        onClick={() => handleCopyCampaignLink(task.link)}
                                                        className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
                                                    >
                                                        {copiedCampaignLink ? '✅ Copied!' : '📋 Copy'}
                                                    </span>
                                                </div>
                                                <a href={task.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-mono break-all font-bold text-xs">
                                                    🔗 {task.link}
                                                </a>
                                            </div>

                                            {/* Description & Instructions */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold">Instructions Given to Worker</span>
                                                <div className="text-gray-700 dark:text-gray-300 font-medium mt-1 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto pr-1 text-xs">
                                                    {task.description || 'No detailed instructions provided.'}
                                                </div>
                                            </div>

                                            {/* Required Proofs Setup */}
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border dark:border-gray-700/30 space-y-2 text-xs">
                                                <span className="text-gray-400 text-[10px] block uppercase font-bold mb-1">Required Proof Criteria</span>
                                                
                                                {task.requireScreenshot && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">📸 Screenshot Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.screenshotInstruction || 'Please upload screenshot proof.'}</p>
                                                    </div>
                                                )}
                                                {task.requireTextProof && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">✍ Text Answer Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.textProofInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireUsername && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">👤 Username Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.usernameInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireUserId && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">🆔 Platform User ID Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.userIdInstruction}</p>
                                                    </div>
                                                )}
                                                {task.requireEmail && (
                                                    <div className="border-l-2 border-blue-500 pl-2">
                                                        <span className="font-bold text-gray-900 dark:text-white block text-[11px]">✉ Email Address Required</span>
                                                        <p className="text-gray-500 italic text-[10px]">{task.emailInstruction}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pricing Information */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 font-bold block uppercase text-[9px]">Rate Per Task</span>
                                                    <span className="font-black text-emerald-500 font-mono">+{task.rewardPerTask} USD</span>
                                                </div>
                                                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700/30">
                                                    <span className="text-gray-400 font-bold block uppercase text-[9px]">Total Campaign Budget</span>
                                                    <span className="font-bold text-gray-900 dark:text-white font-mono">${task.totalBudget} USD</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-gray-400 italic text-xs">Campaign information is unavailable.</div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN: Worker's Submission */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="p-1.5 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-xl text-xs">👤</span>
                                        <h5 className="font-black text-xs uppercase tracking-widest text-green-600 dark:text-green-400">Worker Submitted Evidence</h5>
                                    </div>

                                    {/* Worker Meta / Profile details */}
                                    <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border dark:border-gray-700/30 text-xs">
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Worker User ID</span>
                                            <p className="font-mono text-gray-900 dark:text-white font-bold break-all mt-0.5">{sub.workerId}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Submitted Date & Time</span>
                                            <p className="text-gray-900 dark:text-white font-bold mt-0.5">{new Date(sub.createdAt).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Submission Status</span>
                                            <div className="mt-1">
                                                {sub.status === 'Approved' || sub.status === 'Paid' ? (
                                                    <Badge variant="success">Approved & Paid</Badge>
                                                ) : sub.status === 'Pending' ? (
                                                    <Badge variant="warning">Awaiting Review</Badge>
                                                ) : sub.status === 'Disputed' || sub.disputeOpened ? (
                                                    <Badge variant="info">Disputed</Badge>
                                                ) : (
                                                    <Badge variant="danger">Rejected</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">Earned Payout</span>
                                            <p className="font-black text-emerald-500 font-mono mt-0.5">+{task?.rewardPerTask || sub.rewardAmount} USD</p>
                                        </div>
                                    </div>

                                    {/* Rejection Feedback if Rejected */}
                                    {sub.status === 'Rejected' && sub.rejectionReason && (
                                        <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl text-xs">
                                            <span className="text-red-600 dark:text-red-400 font-black block uppercase text-[10px] tracking-wider mb-0.5">Rejection Feedback Provided</span>
                                            <p className="text-red-700 dark:text-red-300 font-bold">{sub.rejectionReason}</p>
                                        </div>
                                    )}

                                    {/* Evidence inputs */}
                                    <div className="space-y-3.5 pt-1">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Submitted Proof Values</span>
                                        
                                        {sub.submittedProofs && Array.isArray(sub.submittedProofs) && sub.submittedProofs.length > 0 ? (
                                            <div className="space-y-3">
                                                {sub.submittedProofs.map((item: any, idx: number) => {
                                                    const isImage = item.type === 'file' || (typeof item.value === 'string' && (item.value.startsWith('http') && (item.value.includes('.png') || item.value.includes('.jpg') || item.value.includes('.jpeg') || item.value.includes('firebase') || item.value.includes('cloudinary'))));
                                                    return (
                                                        <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40 text-xs">
                                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{item.label || `Proof #${idx + 1}`}</span>
                                                            {isImage ? (
                                                                <div className="mt-2">
                                                                    <div className="relative group w-32 h-32 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(item.value)}>
                                                                        <img src={item.value} alt={item.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <span className="text-white text-lg">🔍</span>
                                                                        </div>
                                                                    </div>
                                                                    <a href={item.value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Full Screenshot</a>
                                                                </div>
                                                            ) : (
                                                                <p className="text-gray-900 dark:text-white font-bold mt-1 break-all">{item.value}</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="space-y-3 text-xs">
                                                {sub.proofText && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proof Text / Answer</span>
                                                        <p className="text-gray-900 dark:text-white font-bold mt-1 break-all">{sub.proofText}</p>
                                                    </div>
                                                )}
                                                {sub.proofUsername && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Username provided</span>
                                                        <p className="text-gray-900 dark:text-white font-bold font-mono mt-1">{sub.proofUsername}</p>
                                                    </div>
                                                )}
                                                {sub.proofUserIdVal && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Worker User ID</span>
                                                        <p className="text-gray-900 dark:text-white font-bold font-mono mt-1">{sub.proofUserIdVal}</p>
                                                    </div>
                                                )}
                                                {sub.proofEmail && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Email address</span>
                                                        <p className="text-gray-900 dark:text-white font-bold mt-1">{sub.proofEmail}</p>
                                                    </div>
                                                )}
                                                {sub.proofImage && (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-2xl border dark:border-gray-700/40">
                                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Screenshot Proof</span>
                                                        <div className="mt-2">
                                                            <div className="relative group w-32 h-32 rounded-xl overflow-hidden border dark:border-gray-700 cursor-zoom-in" onClick={() => setSelectedProofImage(sub.proofImage)}>
                                                                <img src={sub.proofImage} alt="Screenshot Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <span className="text-white text-lg">🔍</span>
                                                                </div>
                                                            </div>
                                                            <a href={sub.proofImage} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1.5 inline-block font-bold">Open Full Screenshot</a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="p-5 border-t dark:border-gray-700 flex justify-between bg-gray-50/50 dark:bg-gray-900/10">
                                <Button type="button" variant="secondary" onClick={() => setSelectedWorkerSubmissionForDetails(null)}>
                                    Close Window
                                </Button>
                                {(sub.status === 'Pending' || (sub.status === 'Disputed' && sub.disputeStage === 'CreatorReview')) && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await handleApproveSubmission(sub._id);
                                                setSelectedWorkerSubmissionForDetails(null);
                                            }}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-600/10"
                                        >
                                            ✔ Accept & Pay
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRejectingSubId(sub._id);
                                                setRejectionFeedback('');
                                                setSelectedWorkerSubmissionForDetails(null);
                                            }}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                                        >
                                            ✖ Reject Proof
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default UserTasksSubmit;
