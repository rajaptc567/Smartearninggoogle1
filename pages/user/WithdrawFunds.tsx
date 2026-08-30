
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Withdrawal, formatCurrency, currencySymbols, Task, InvestmentPlan } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useData } from '../../hooks/useData';
import { createWithdrawal, purchasePlan as apiPurchasePlan } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { evaluateWithdrawalRules, getPayoutOptionsForUser } from '../../utils/withdrawalRuleEngine';

const formatFriendlyError = (err: any): string => {
    if (!err) return 'An unexpected error occurred. Please try again.';
    const message = typeof err === 'string' ? err : (err.message || String(err));
    if (message.includes('<!doctype') || message.includes('JSON') || message.includes('SyntaxError') || message.includes('Unexpected token')) {
        return 'Unable to process withdrawal right now due to network connectivity. Please try again shortly.';
    }
    return message;
};

const WithdrawalHeaderIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LockIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Amount', 'Method', 'Details', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-2xl mx-auto px-4 relative">
             <div className="absolute top-5 left-8 right-8 h-1 bg-slate-200 dark:bg-slate-800 -z-0 hidden sm:block rounded-full"></div>
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                            isActive 
                                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 scale-110 ring-4 ring-teal-500/20' 
                                : isCompleted 
                                ? 'bg-emerald-600 text-white shadow-md' 
                                : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[10px] mt-2.5 font-black uppercase tracking-wider transition-colors duration-300 ${
                            isActive 
                                ? 'text-teal-600 dark:text-teal-400' 
                                : isCompleted 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-slate-400 dark:text-slate-500'
                        }`}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const WithdrawFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, paymentMethods, withdrawals, tasks, settings, userTaskSubmissions = [], transactions = [] } = state;
    const { restrictWithdrawalAmount, withdrawalFrequency, isTasksEnabled } = settings;
    const navigate = useNavigate();

    // Wizard State
    const [step, setStep] = useState(1);

    const isHub = useMemo(() => {
        return localStorage.getItem('dashboard_mode') === 'work_and_earn';
    }, []);

    const exchangeRate = state.settings?.exchangeRates?.[currentUser?.currency || 'USD'] || 1;

    const userIdStr = currentUser?._id?.toString() || '';

    const approvedTaskSubmissions = useMemo(() => {
        return userTaskSubmissions.filter(s => 
            s.userId?.toString() === userIdStr && 
            (s.status === 'Approved' || s.status === 'Paid')
        );
    }, [userTaskSubmissions, userIdStr]);

    const totalSubmissionsEarningsUSD = useMemo(() => {
        return approvedTaskSubmissions.reduce((sum, s) => sum + (s.rewardAmount || 0), 0);
    }, [approvedTaskSubmissions]);

    const approvedTaskTrxs = useMemo(() => {
        return transactions.filter(t => 
            t.userId?.toString() === userIdStr && 
            (t.type === 'Task Reward' || t.type === 'Micro-Task' || t.type === 'Task Completed' || t.description?.toLowerCase().includes('job completed') || t.description?.toLowerCase().includes('task reward')) &&
            (t.status === 'Approved' || t.status === 'Paid' || !t.status) &&
            !t.description?.toLowerCase().includes('deduction')
        );
    }, [transactions, userIdStr]);

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

    const totalLifetimeTaskEarningsUSD = useMemo(() => {
        const sumFromHistory = totalSubmissionsEarningsUSD + standaloneTrxEarningsUSD;
        return Math.max(sumFromHistory, currentUser?.taskEarningsBalance || 0);
    }, [totalSubmissionsEarningsUSD, standaloneTrxEarningsUSD, currentUser?.taskEarningsBalance]);

    // Calculate pending & total deducted withdrawals for Hub
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

            const isCampaign = descLower.includes('campaign');

            const isConversionOrTransferOut = 
                !isCampaign && (
                    typeLower.includes('task wallet conversion') ||
                    typeLower.includes('task wallet transfer') ||
                    typeLower.includes('task earnings conversion') ||
                    typeLower.includes('task earnings transfer') ||
                    (descLower.includes('converted') && (descLower.includes('task earnings') || descLower.includes('task wallet'))) ||
                    (descLower.includes('transferred') && (descLower.includes('task earnings') || descLower.includes('task wallet')) && !descLower.includes('investment to task'))
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
            return Number(Math.max(0, currentUser.taskEarningsBalance).toFixed(2));
        }
        const dynamicNet = Math.max(0, totalLifetimeTaskEarningsUSD - totalDeductedHubWithdrawalsUSD - totalConvertedTaskEarningsUSD - fundsUsedForCampaignUSD);
        return Number(dynamicNet.toFixed(2));
    }, [currentUser?.taskEarningsBalance, totalLifetimeTaskEarningsUSD, totalDeductedHubWithdrawalsUSD, totalConvertedTaskEarningsUSD, fundsUsedForCampaignUSD]);

    const currentBalance = useMemo(() => {
        if (!currentUser) return 0;
        if (isHub) {
            return netAvailableTaskEarningsUSD * exchangeRate;
        }
        const pendingWalletWithdrawals = (withdrawals || [])
            .filter(w => w.userId?.toString() === userIdStr && !((w as any).isHub) && w.status === 'Pending')
            .reduce((sum, w) => sum + (w.amount || 0), 0);
        return Math.max(0, (currentUser.walletBalance ?? 0) - pendingWalletWithdrawals);
    }, [currentUser, isHub, exchangeRate, netAvailableTaskEarningsUSD, withdrawals, userIdStr]);

    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [accountTitle, setAccountTitle] = useState('');
    const [expandedWithdrawalId, setExpandedWithdrawalId] = useState<string | null>(null);
    const [accountNumber, setAccountNumber] = useState('');
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

    // History Filter State
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Plan Purchase Modal State
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isPlanOpportunityModalOpen, setIsPlanOpportunityModalOpen] = useState(false);
    const [planModalTab, setPlanModalTab] = useState<'view_plan' | 'view_all'>('view_plan');
    const [selectedPlanForPurchase, setSelectedPlanForPurchase] = useState<InvestmentPlan | null>(null);
    const [isPurchasingPlan, setIsPurchasingPlan] = useState(false);
    const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);

    // --- ELIGIBILITY CHECK: UNCOMPLETED REQUIRED TASKS ---
    const pendingRequiredTasks = useMemo(() => {
        // If the Task feature is disabled globally, we don't enforce these requirements
        if (!currentUser || !isTasksEnabled) return [];
        const completedTaskIds = (currentUser.completedTasks || []).map(ct => ct.taskId);
        return tasks.filter(t => t.status === 'Active' && t.isRequiredForWithdrawal && !completedTaskIds.includes(t._id));
    }, [tasks, currentUser, isTasksEnabled]);

    // --- WORK & EARN CONDITIONAL WITHDRAWAL RULES ENGINE ---
    const ruleEvaluation = useMemo(() => {
        if (!currentUser) return { passed: true, blockedByRule: null, logs: [], currentAttemptNumber: 1 };
        return evaluateWithdrawalRules(
            currentUser,
            settings.workAndEarnWithdrawalRules || [],
            withdrawals,
            state.userTasks || [],
            state.userTaskSubmissions || [],
            state.users || [],
            state.investmentPlans || [],
            settings.workAndEarnPayoutTierConfig
        );
    }, [currentUser, settings.workAndEarnWithdrawalRules, withdrawals, state.userTasks, state.userTaskSubmissions, state.users, state.investmentPlans, settings.workAndEarnPayoutTierConfig]);

    // Derived Data
    const withdrawalMethods = useMemo(() => {
        if (!currentUser) return [];
        return paymentMethods.filter(method => 
            method.type === 'Withdrawal' && 
            method.status === 'Enabled' &&
            method.currency === currentUser.currency
        );
    }, [paymentMethods, currentUser]);
    
    const userActivePlanPrices = useMemo(() => {
        if (!currentUser?.activePlans) return [];
        return [...new Set(currentUser.activePlans.map(p => p.price))]
            .sort((a: number, b: number) => a - b);
    }, [currentUser]);

    const userWithdrawalCount = useMemo(() => {
        return userHubWithdrawals.filter(w => w.status === 'Approved' || w.status === 'Paid').length;
    }, [userHubWithdrawals]);

    const payoutOptions = useMemo(() => {
        if (!currentUser) return [];
        return getPayoutOptionsForUser(
            currentUser,
            settings.workAndEarnPayoutTierConfig,
            settings.workAndEarnWithdrawalRules || [],
            state.investmentPlans || [],
            userWithdrawalCount,
            exchangeRate
        );
    }, [currentUser, settings.workAndEarnPayoutTierConfig, settings.workAndEarnWithdrawalRules, state.investmentPlans, userWithdrawalCount, exchangeRate]);

    const activePlansInUserCurrency = useMemo(() => {
        if (!currentUser) return [];
        const userCurr = (currentUser.currency || 'USD').trim().toUpperCase();
        const allPlans = state.investmentPlans || [];

        const active = allPlans.filter(p => {
            if (!p) return false;
            const st = String(p.status || '').trim().toLowerCase();
            return st === 'active' || p.status === Status.Active || (p as any).enabled === true || p.status === undefined || p.status === null;
        });

        if (active.length === 0) return [];

        const exactMatch = active.filter(p => String(p.currency || 'USD').trim().toUpperCase() === userCurr);
        if (exactMatch.length > 0) {
            return exactMatch.sort((a, b) => (a.price || 0) - (b.price || 0));
        }

        // Fallback: If no exact currency match, convert plans to user currency or display available active plans
        const rate = exchangeRate > 0 ? exchangeRate : 1;
        return active.map(p => {
            const pCurr = String(p.currency || 'USD').trim().toUpperCase();
            let convertedPrice = p.price || 0;
            let convertedMinWithdraw = p.minWithdraw || 0;

            if (pCurr === 'USD' && userCurr !== 'USD' && rate > 0) {
                convertedPrice = (p.price || 0) * rate;
                convertedMinWithdraw = (p.minWithdraw || 0) * rate;
            } else if (pCurr !== 'USD' && userCurr === 'USD' && rate > 0) {
                convertedPrice = (p.price || 0) / rate;
                convertedMinWithdraw = (p.minWithdraw || 0) / rate;
            }

            return {
                ...p,
                price: Math.round(convertedPrice * 100) / 100,
                minWithdraw: Math.round(convertedMinWithdraw * 100) / 100,
                currency: userCurr as any,
            };
        }).sort((a, b) => (a.price || 0) - (b.price || 0));
    }, [currentUser, state.investmentPlans, exchangeRate]);

    const matchingPlan = useMemo(() => {
        if (activePlansInUserCurrency.length === 0) return null;
        const numAmount = parseFloat(amount) || 0;
        if (numAmount <= 0) return activePlansInUserCurrency[0];

        // 1. Check for exact price match
        const exact = activePlansInUserCurrency.find(p => Math.abs((p.price || 0) - numAmount) < 0.01);
        if (exact) return exact;

        // 2. Find closest plan in price to the withdrawal amount
        let closest = activePlansInUserCurrency[0];
        let minDiff = Math.abs((closest.price || 0) - numAmount);

        for (let i = 1; i < activePlansInUserCurrency.length; i++) {
            const p = activePlansInUserCurrency[i];
            const diff = Math.abs((p.price || 0) - numAmount);
            if (diff < minDiff) {
                minDiff = diff;
                closest = p;
            }
        }
        return closest;
    }, [activePlansInUserCurrency, amount]);

    // Auto-trigger Investment Plan Pop-up when reaching Step 4 if enabled by Admin
    useEffect(() => {
        if (step === 4) {
            const isPopupEnabled = settings.workAndEarnPayoutTierConfig?.enableInvestmentPlanPopupOnWithdrawal !== false;
            if (isPopupEnabled) {
                setPlanModalTab('view_plan');
                setIsPlanOpportunityModalOpen(true);
            }
        }
    }, [step, settings.workAndEarnPayoutTierConfig?.enableInvestmentPlanPopupOnWithdrawal]);

    const handleConfirmPurchasePlan = async (targetPlan?: InvestmentPlan) => {
        const planToBuy = targetPlan || selectedPlanForPurchase;
        if (!planToBuy || !currentUser) return;
        setIsPurchasingPlan(true);
        try {
            const result = await apiPurchasePlan(currentUser._id, planToBuy._id);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

            const notifPayload = {
                _id: 'notif_p_' + Date.now(),
                userId: currentUser._id,
                senderType: 'System' as const,
                subject: 'Investment Plan Activated',
                message: `Congratulations! You successfully purchased the ${planToBuy.name} plan for ${formatCurrency(planToBuy.price, planToBuy.currency)}. Your plan is active and daily earning opportunities are unlocked!`,
                isPopup: false,
                popupShown: false,
                read: false,
                date: new Date().toISOString()
            };
            dispatch({ type: 'ADD_NOTIFICATION', payload: notifPayload });

            setPurchaseSuccessMessage(`Successfully purchased ${planToBuy.name}! Redirecting to investment module...`);
            setIsPlanModalOpen(false);
            setIsPlanOpportunityModalOpen(false);
            setSelectedPlanForPurchase(null);

            // Redirect to Investment Module as requested
            navigate('/member/plans', { state: { purchasedPlanId: planToBuy._id, successMessage: `Successfully purchased ${planToBuy.name}!` } });
        } catch (error) {
            console.error('Failed to purchase plan:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not purchase plan.'}`);
        } finally {
            setIsPurchasingPlan(false);
        }
    };

    const selectedMethod: PaymentMethod | undefined = useMemo(() =>
        withdrawalMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, withdrawalMethods]
    );

    // Fee Calculation
    const [fee, setFee] = useState(0);
    const [finalAmount, setFinalAmount] = useState(0);

    useEffect(() => {
        const numericAmount = parseFloat(amount);
        if (selectedMethod && !isNaN(numericAmount) && numericAmount > 0) {
            const calculatedFee = (numericAmount * selectedMethod.feePercent) / 100;
            setFee(calculatedFee);
            setFinalAmount(numericAmount - calculatedFee);
        } else {
            setFee(0);
            setFinalAmount(0);
        }
    }, [amount, selectedMethod]);

    // Check Frequency Cooldown
    useEffect(() => {
        if (currentUser && withdrawalFrequency?.enabled) {
            const myLastWithdrawal = withdrawals
                .filter(w => w.userId === currentUser._id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (myLastWithdrawal) {
                const lastDate = new Date(myLastWithdrawal.date).getTime();
                const now = Date.now();
                let durationMs = 0;
                const { value, unit } = withdrawalFrequency;

                switch (unit) {
                    case 'hours': durationMs = value * 60 * 60 * 1000; break;
                    case 'days': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'weeks': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'months': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }

                const nextAllowedTime = lastDate + durationMs;
                
                if (now < nextAllowedTime) {
                    const remainingMs = nextAllowedTime - now;
                    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    setCooldownMessage(`Limit reached: One withdrawal every ${value} ${unit}. Available in ${days}d ${hours}h ${minutes}m.`);
                } else {
                    setCooldownMessage(null);
                }
            }
        } else {
            setCooldownMessage(null);
        }
    }, [currentUser, withdrawals, withdrawalFrequency]);

    // Reset method if amount changes and method becomes invalid
    useEffect(() => {
        if (selectedMethodId && !withdrawalMethods.find(m => m._id === selectedMethodId)) {
            setSelectedMethodId('');
            if (step > 2) setStep(2);
        }
    }, [withdrawalMethods, selectedMethodId, step]);

    // Filtered History
    const filteredWithdrawals = useMemo(() => {
        if (!currentUser) return [];
        return withdrawals
            .filter(w => {
                if (w.userId !== currentUser._id) return false;
                if (historyStatus && w.status !== historyStatus) return false;
                if (historyDateFrom || historyDateTo) {
                    const itemDate = new Date(w.date).setHours(0,0,0,0);
                    const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : null;
                    const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : null;
                    if (from && itemDate < from) return false;
                    if (to && itemDate > to) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [withdrawals, currentUser, historyStatus, historyDateFrom, historyDateTo]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [historyStatus, historyDateFrom, historyDateTo, itemsPerPage]);

    // Pagination Logic
    const totalItems = filteredWithdrawals.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedWithdrawals = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredWithdrawals.slice(start, start + itemsPerPage);
    }, [filteredWithdrawals, currentPage, itemsPerPage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);

        if (!currentUser) return alert('User not found.');
        if (!selectedMethod || isNaN(numericAmount) || !accountTitle || !accountNumber) {
            return alert('Please fill all required fields.');
        }
        if (numericAmount > currentBalance) {
            return alert(`Withdrawal amount cannot exceed your ${isHub ? 'task earnings available balance' : 'wallet balance'}.`);
        }

        // When user balance is sufficient and plans exist, show the investment plan opportunity modal first!
        if (activePlansInUserCurrency.length > 0) {
            setIsPlanOpportunityModalOpen(true);
            return;
        }

        await executeActualWithdrawal(numericAmount);
    };

    const executeActualWithdrawal = async (numericAmount: number) => {
        setIsSubmitting(true);
        try {
            const withdrawalData = {
                userId: currentUser._id,
                userName: currentUser.username,
                method: selectedMethod.name,
                amount: numericAmount,
                fee: fee,
                finalAmount: finalAmount,
                accountTitle: accountTitle,
                accountNumber: accountNumber,
                userNotes: userNotes,
                isHub: isHub,
            };

            const result = await createWithdrawal(withdrawalData);
            dispatch({ type: 'ADD_WITHDRAWAL', payload: result.withdrawal });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

            const notifPayload = {
                _id: 'notif_w_' + Date.now(),
                userId: currentUser._id,
                senderType: 'System' as const,
                subject: 'Withdrawal Request Placed',
                message: `Your withdrawal request of ${formatCurrency(numericAmount, currentUser.currency)} via ${selectedMethod.name} has been placed successfully and is now under processing.`,
                isPopup: false,
                popupShown: false,
                read: false,
                date: new Date().toISOString()
            };
            dispatch({ type: 'ADD_NOTIFICATION', payload: notifPayload });

            setIsSubmitted(true);
            setIsPlanOpportunityModalOpen(false);

        } catch (error) {
             console.error("Failed to submit withdrawal request:", error);
             alert(formatFriendlyError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) return null;

    // --- INSTANT RESTRICTION CHECK ---
    if (currentUser.restrictions?.withdrawal) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <ShieldExclamationIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Withdrawal Access Blocked</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed font-medium">
                        Your account's ability to liquidate earnings has been temporarily restricted by the security department for your protection.
                    </p>
                    
                    <div className="w-full p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 mb-8">
                        <div className="flex items-center gap-4 text-left">
                            <span className="text-2xl">🚨</span>
                            <div>
                                <p className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Security Review Active</p>
                                <p className="text-xs text-gray-500 font-medium">Please contact our support team or open a formal dispute for manual account verification.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <Button onClick={() => navigate('/member/disputes')} className="rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20">Open Support Ticket</Button>
                        <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs">Return Dashboard</Button>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER LOCKED SCREEN IF TASKS PENDING ---
    if (pendingRequiredTasks.length > 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 text-center animate-fade-in">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mb-8 border border-red-200 dark:border-red-800">
                        <LockIcon />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 leading-none">Access Restricted</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
                        Platform security policy requires members to complete specific engagement missions before unlocking digital asset withdrawals.
                    </p>
                    
                    <div className="w-full space-y-4 mb-10 text-left">
                        {pendingRequiredTasks.map(task => (
                            <div key={task._id} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 group hover:border-blue-600 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">{task.title}</span>
                                    <span className="text-[9px] text-red-600 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Mandatory Verification</span>
                                </div>
                                <button 
                                    onClick={() => navigate('/member/tasks')}
                                    className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                >
                                    Complete &rarr;
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 w-full text-left">
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed">
                            <span className="text-lg mr-2">💡</span> Automated Unlock: Completing these tasks will instantly restore payout functionality for your wallet.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // --- RENDER LOCKED SCREEN IF CONDITIONAL WITHDRAWAL RULE TRIGGERED ---
    if (!ruleEvaluation.passed && ruleEvaluation.blockedByRule) {
        const blockedRule = ruleEvaluation.blockedByRule;
        const nc = blockedRule.notificationConfig || {
            title: 'Investment Plan Required',
            message: 'To continue with your next withdrawal, you must first activate an eligible Investment Plan.',
            primaryActionButtonText: 'View Investment Plans',
            primaryActionUrl: '/member/plans',
            secondaryActionButtonText: 'Transfer Balance',
            secondaryActionUrl: '/member/transfer'
        };

        return (
            <div className="max-w-2xl mx-auto mt-10 p-8 sm:p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-indigo-100 dark:border-indigo-900/40 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950/60 rounded-3xl flex items-center justify-center mb-6 border border-indigo-200 dark:border-indigo-800 shadow-xl shadow-indigo-500/10">
                        <span className="text-4xl">💎</span>
                    </div>

                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3 border border-indigo-200 dark:border-indigo-800">
                        Withdrawal Rule #{ruleEvaluation.currentAttemptNumber} Active
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">
                        {nc.title || 'Investment Plan Required'}
                    </h2>

                    <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto leading-relaxed text-sm font-medium">
                        {nc.message || 'To continue with your next withdrawal, you must first activate an eligible Investment Plan in the Investment Module.'}
                    </p>

                    <div className="w-full p-5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 mb-8 text-left space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">ℹ️</span>
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase">Automated Rule Verification</p>
                                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                    Once you complete this requirement, your withdrawal access will unlock automatically.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                        <Button 
                            onClick={() => navigate(nc.primaryActionUrl || '/member/plans')} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20"
                        >
                            {nc.primaryActionButtonText || 'View Investment Plans'}
                        </Button>

                        {nc.secondaryActionButtonText && (
                            <Button 
                                onClick={() => navigate(nc.secondaryActionUrl || '/member/transfer')} 
                                variant="secondary" 
                                className="rounded-2xl py-4 px-8 font-black uppercase tracking-widest text-xs"
                            >
                                {nc.secondaryActionButtonText}
                            </Button>
                        )}

                        <Button 
                            onClick={() => navigate('/member')} 
                            variant="secondary" 
                            className="rounded-2xl py-4 px-6 font-black uppercase tracking-widest text-xs opacity-75 hover:opacity-100"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto mt-10 p-10 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-800 animate-fade-in">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-24 w-24 flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
                    <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Settlement Requested!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed font-medium">Your request has entered our automated queue. Verifications typically conclude within 3-12 hours.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button onClick={() => window.location.reload()} className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">New Request</Button>
                    <Button onClick={() => navigate('/member')} variant="secondary" className="rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Dashboard Hub</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto pb-12 px-2">
            <div className="bg-slate-900 dark:bg-slate-950 p-6 md:p-8 rounded-2xl md:rounded-[2rem] text-white border border-slate-800 shadow-2xl relative overflow-hidden mb-6 md:mb-8 group">
                <div className="absolute inset-0 bg-teal-500/5 opacity-50 pointer-events-none"></div>
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl group-hover:bg-teal-500/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tighter uppercase leading-none text-white">
                            {isHub ? "Withdraw Hub Funds" : "Withdraw Funds"}
                        </h1>
                        <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed font-medium">
                            {isHub 
                                ? "Redeem your Micro Task & Gigs earnings and move them to your personal account. Choose your preferred withdrawal method and provide the necessary details."
                                : "Redeem your investment earnings and move them to your personal account. Choose your preferred withdrawal method and provide the necessary details to process your payout."
                            }
                        </p>
                    </div>
                    <div className="bg-slate-800/80 dark:bg-slate-900/90 backdrop-blur-xl p-4 md:p-5 rounded-xl md:rounded-2xl border border-slate-700/60 dark:border-slate-800 text-center w-full md:w-auto md:min-w-[220px] shadow-lg">
                        <p className="text-[9px] text-teal-400 uppercase tracking-[0.25em] font-black mb-0.5">
                            {isHub ? "Net Task Earnings Withdrawable" : "Withdrawable Balance"}
                        </p>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter text-white">
                            {formatCurrency(currentBalance, currentUser.currency)}
                        </p>
                        {isHub && currentUser.currency !== 'USD' && (
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                = ${netAvailableTaskEarningsUSD.toFixed(2)} USD
                            </p>
                        )}
                        {isHub && (
                            <div className="text-[11px] text-emerald-400 font-bold mt-1.5 flex flex-col items-center gap-0.5">
                                <span>Lifetime Task Earnings: ${totalLifetimeTaskEarningsUSD.toFixed(2)} USD</span>
                                {currentUser.currency !== 'USD' && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        (~{formatCurrency(totalLifetimeTaskEarningsUSD * exchangeRate, currentUser.currency)})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {cooldownMessage && (
                <div className="mb-10 p-6 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-3xl text-yellow-800 dark:text-yellow-200 flex items-center shadow-xl animate-fade-in">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl mr-5 shrink-0"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    <div>
                        <p className="font-black text-xs uppercase tracking-widest mb-1">Temporal Frequency Limit</p>
                        <p className="text-sm font-bold opacity-80">{cooldownMessage}</p>
                    </div>
                </div>
            )}

            <StepIndicator currentStep={step} />

            <div className={`bg-white dark:bg-slate-900 p-5 sm:p-8 md:p-10 rounded-2xl md:rounded-[2rem] shadow-xl border border-slate-200/80 dark:border-slate-800 ${cooldownMessage ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                
                {/* STEP 1: AMOUNT */}
                {step === 1 && (
                    <div className="animate-fade-in space-y-8 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Settlement Value</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 1: Payout allocation</p>
                        </div>

                        {restrictWithdrawalAmount && !isHub ? (
                            <div className="space-y-6">
                                {userActivePlanPrices.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {userActivePlanPrices.map(price => (
                                            <button
                                                key={price}
                                                type="button"
                                                onClick={() => setAmount(price.toString())}
                                                className={`py-5 px-6 rounded-3xl font-black uppercase text-xs tracking-widest transition-all duration-300 border-2 ${
                                                    amount === price.toString()
                                                    ? 'bg-teal-600 text-white border-teal-400 shadow-2xl shadow-teal-500/40 scale-105'
                                                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800 hover:border-teal-500/30'
                                                }`}
                                            >
                                                {formatCurrency(price, currentUser.currency)}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-10 bg-yellow-50 dark:bg-yellow-950/20 rounded-[2rem] border border-yellow-100 dark:border-yellow-900/30">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-bold mb-6">
                                            Active Plan Requirement: You must own a valid investment tier to unlock plan-matching payouts.
                                        </p>
                                        <Button onClick={() => navigate('/member/plans')} className="rounded-xl px-10 py-4 font-black uppercase text-[10px] tracking-widest">Buy Plan Now</Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {isHub && pendingHubWithdrawalsUSD > 0 && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-200">
                                        <span className="text-xl">⏳</span>
                                        <div className="text-xs">
                                            <span className="font-black uppercase block">Pending Withdrawal Under Review</span>
                                            <span className="font-medium">
                                                ${pendingHubWithdrawalsUSD.toFixed(2)} USD (~{Math.round(pendingHubWithdrawalsUSD * exchangeRate)} {currentUser.currency}) is currently in review and deducted from your available withdrawable balance.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {isHub ? (
                                    <div className="space-y-4">
                                        {payoutOptions.length > 0 ? (
                                            <>
                                                <label className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest block ml-1">
                                                    Select Configured Payout Option / Withdrawal Point:
                                                </label>

                                                {(() => {
                                                    const mobileCols = settings.workAndEarnPayoutTierConfig?.payoutLayoutColumnsMobile || 2;
                                                    const desktopCols = settings.workAndEarnPayoutTierConfig?.payoutLayoutColumns || 3;
                                                    const mobileClass = mobileCols === 4 ? 'grid-cols-4' : mobileCols === 3 ? 'grid-cols-3' : 'grid-cols-2';
                                                    const desktopClass = desktopCols === 4 ? 'sm:grid-cols-4' : desktopCols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
                                                    return (
                                                        <div className={`grid ${mobileClass} ${desktopClass} gap-2.5 sm:gap-3`}>
                                                            {payoutOptions.map(opt => {
                                                                const isSelected = amount === opt.amount.toString();

                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={opt.amount}
                                                                        onClick={() => setAmount(opt.amount.toString())}
                                                                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-wider border-2 transition-all flex items-center justify-center text-center ${
                                                                            isSelected
                                                                            ? 'bg-teal-600 text-white border-teal-400 shadow-xl shadow-teal-500/30 scale-102 ring-2 ring-teal-500/20'
                                                                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                                                                        }`}
                                                                    >
                                                                        <span className="text-xs sm:text-base font-black block tracking-tight">
                                                                            {formatCurrency(opt.amount, currentUser.currency)}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}

                                                {amount ? (
                                                    <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-2xl flex items-center justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider block">Selected Withdrawal Point</span>
                                                            <span className="text-xl font-black text-teal-950 dark:text-teal-100">
                                                                {formatCurrency(parseFloat(amount), currentUser.currency)}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-bold px-3 py-1 bg-teal-600 text-white rounded-full uppercase tracking-wider">
                                                            Tier Selected
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-500 font-medium">
                                                        Tap one of the payout tier buttons above to select your withdrawal amount.
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700">
                                                <p className="text-xs text-slate-500 font-bold">No payout tier options available at this time.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Redemption Amount</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-400 font-bold">
                                                {currencySymbols[currentUser.currency]}
                                            </span>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full pl-8 p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/10 focus:border-teal-600 outline-none transition-all dark:text-white text-2xl font-black tracking-tighter"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {purchaseSuccessMessage && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <span>🎉</span>
                                    <span className="font-bold">{purchaseSuccessMessage}</span>
                                </div>
                                <button 
                                    onClick={() => setPurchaseSuccessMessage(null)}
                                    className="text-emerald-600 dark:text-emerald-400 hover:opacity-80 font-bold text-sm"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="pt-6">
                            <Button 
                                onClick={() => {
                                    setStep(2);
                                }} 
                                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > currentBalance}
                                className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-700 border-0"
                            >
                                Select Payout Method &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* INVESTMENT PLAN OPPORTUNITY MODAL (RENDERED GLOBALLY ON ALL STEPS) */}
                <Modal isOpen={isPlanOpportunityModalOpen} onClose={() => setIsPlanOpportunityModalOpen(false)} maxW="max-w-2xl">
                    <div className="p-6 text-gray-900 dark:text-white space-y-6 relative">
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-400 dark:from-amber-600 dark:to-yellow-500 rounded-2xl flex items-center justify-center mx-auto text-slate-950 text-2xl shadow-lg shadow-amber-500/20">
                                💎
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                Maximize Your Daily Income!
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                                You are requesting to withdraw <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(parseFloat(amount) || 0, currentUser?.currency)}</span>. Here is the matching investment plan in your currency ({currentUser?.currency || 'USD'}):
                            </p>
                        </div>

                        {/* REFERRAL INCOME BENEFIT BANNER */}
                        <div className="bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-teal-500/10 p-3.5 rounded-2xl border border-amber-500/30 flex items-start gap-3">
                            <span className="text-xl shrink-0">🎁</span>
                            <div className="text-xs space-y-0.5">
                                <p className="font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Earn Extra Referral Income!</p>
                                <p className="text-gray-600 dark:text-gray-300 leading-snug">
                                    Invite friends and receive direct referral commissions plus multi-level network bonuses whenever your team members activate an investment plan.
                                </p>
                            </div>
                        </div>

                        {/* Modal Navigation Tabs */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setPlanModalTab('view_plan')}
                                className={`flex-1 py-2.5 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    planModalTab === 'view_plan'
                                    ? 'bg-amber-500 text-slate-950 shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                📌 Matching Plan ({currentUser?.currency || 'USD'})
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlanModalTab('view_all')}
                                className={`flex-1 py-2.5 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                                    planModalTab === 'view_all'
                                    ? 'bg-amber-500 text-slate-950 shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                🌐 View All Plans ({activePlansInUserCurrency.length})
                            </button>
                        </div>

                        {/* TAB 1: MATCHING PLAN CORRESPONDING TO WITHDRAWAL AMOUNT */}
                        {planModalTab === 'view_plan' && (() => {
                            if (!matchingPlan) {
                                return (
                                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 space-y-3">
                                        <p>No active investment plans found for currency <span className="font-bold">{currentUser?.currency || 'USD'}</span>.</p>
                                        <button
                                            type="button"
                                            onClick={() => setPlanModalTab('view_all')}
                                            className="text-amber-500 hover:underline font-bold text-xs uppercase"
                                        >
                                            View All Active Plans &rarr;
                                        </button>
                                    </div>
                                );
                            }

                            const getPlanDurationText = (plan: any) => {
                                if (!plan) return 'Unlimited / Lifetime';
                                const val = plan.durationDays ?? plan.duration ?? plan.durationInDays ?? plan.validityDays;
                                if (val === undefined || val === null || val === '') return 'Unlimited / Lifetime';
                                const num = Number(val);
                                if (isNaN(num) || num <= 0) return 'Unlimited / Lifetime';
                                if (num === 1) return '1 Day';
                                return `${num} Days`;
                            };

                            const renderPlanCard = (plan: InvestmentPlan, isMatching: boolean = false) => {
                                const isRunning = (currentUser?.activePlans || []).some(
                                    (ap: any) => ap.planId?.toString() === plan._id?.toString() || ap.planName === plan.name
                                );

                                const directComm = plan.directCommissions?.[0];
                                const directCommVal = directComm ? `${directComm.value}${directComm.type === 'percentage' ? '%' : ''}` : 'Standard';
                                const indirectLevels = plan.indirectCommissions?.length || 0;
                                const totalLevels = indirectLevels > 0 ? `${1 + indirectLevels} Levels` : 'Direct Only (1 Level)';
                                const durationLabel = getPlanDurationText(plan);
                                const directSlotText = plan.directReferralLimit ? `${plan.directReferralLimit} Capacity` : 'Unlimited Capacity';

                                return (
                                    <div 
                                        key={plan._id}
                                        className={`p-5 rounded-2xl border transition-all space-y-4 ${
                                            isMatching
                                            ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/10 border-amber-500/40 shadow-lg'
                                            : isRunning
                                            ? 'bg-emerald-950/20 dark:bg-emerald-950/30 border-emerald-500/40 text-gray-900 dark:text-emerald-100 shadow-md'
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white shadow-sm'
                                        }`}
                                    >
                                        {/* Header: Plan Name, Price, Currency & Badges */}
                                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200/60 dark:border-gray-800 pb-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {isMatching && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                                                            📌 Matching Plan
                                                        </span>
                                                    )}
                                                    {isRunning && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                                                            ✓ Active Subscription
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-gray-950 dark:text-white">
                                                    {plan.name || 'Investment Plan'}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 block leading-none">
                                                    {formatCurrency(plan.price, plan.currency || currentUser?.currency)}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 block">
                                                    Currency: {plan.currency || currentUser?.currency || 'USD'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Plan Description */}
                                        <div className="bg-amber-500/5 dark:bg-gray-950/70 p-3 rounded-xl border border-amber-500/15 dark:border-gray-800">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block mb-1">
                                                Plan Overview & Details
                                            </span>
                                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                {plan.description?.trim() 
                                                    ? plan.description 
                                                    : 'Official active investment package to scale daily task income, activate referral bonuses, and elevate withdrawal privileges.'}
                                            </p>
                                        </div>

                                        {/* 4-Column Metric Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Plan Duration</span>
                                                <span className="font-extrabold text-amber-600 dark:text-amber-400">{durationLabel}</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Min Withdraw</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(plan.minWithdraw, plan.currency || currentUser?.currency)}</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Direct Referral</span>
                                                <span className="font-bold text-teal-600 dark:text-teal-400">{directCommVal} Bonus</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Network Depth</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalLevels}</span>
                                            </div>
                                        </div>

                                        {/* Direct Referral Limit & Custom Features */}
                                        <div className="space-y-2 text-xs pt-1 border-t border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-[9px] tracking-wider">Direct Referral Capacity:</span>
                                                <span className="font-black text-gray-800 dark:text-gray-200">{directSlotText}</span>
                                            </div>

                                            {plan.customFeatures && plan.customFeatures.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Custom Features & Privileges:</span>
                                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-gray-700 dark:text-gray-300">
                                                        {plan.customFeatures.map((feat, idx) => (
                                                            <li key={idx} className="flex items-center gap-1.5">
                                                                <span className="text-amber-500 font-black">✓</span> {feat}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Row */}
                                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200/60 dark:border-gray-800">
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Deducts <span className="font-bold text-amber-500">{formatCurrency(plan.price, plan.currency || currentUser?.currency)}</span> from withdrawable balance.
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={() => handleConfirmPurchasePlan(plan)}
                                                disabled={isPurchasingPlan || currentBalance < plan.price}
                                                className="w-full sm:w-auto py-2.5 px-5 rounded-xl font-black uppercase text-xs tracking-wider bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 shrink-0"
                                            >
                                                {isPurchasingPlan ? 'Processing...' : `🛒 Purchase (${formatCurrency(plan.price, plan.currency)})`}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-3">
                                    {renderPlanCard(matchingPlan, true)}
                                    <div className="pt-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setPlanModalTab('view_all')}
                                            className="text-amber-600 dark:text-amber-400 hover:underline font-black text-xs uppercase tracking-wider inline-flex items-center gap-1"
                                        >
                                            View All Active Plans ({activePlansInUserCurrency.length}) &rarr;
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* TAB 2: VIEW ALL PLANS */}
                        {planModalTab === 'view_all' && (() => {
                            const getPlanDurationText = (plan: any) => {
                                if (!plan) return 'Unlimited / Lifetime';
                                const val = plan.durationDays ?? plan.duration ?? plan.durationInDays ?? plan.validityDays;
                                if (val === undefined || val === null || val === '') return 'Unlimited / Lifetime';
                                const num = Number(val);
                                if (isNaN(num) || num <= 0) return 'Unlimited / Lifetime';
                                if (num === 1) return '1 Day';
                                return `${num} Days`;
                            };

                            const renderPlanCard = (plan: InvestmentPlan, isMatching: boolean = false) => {
                                const isRunning = (currentUser?.activePlans || []).some(
                                    (ap: any) => ap.planId?.toString() === plan._id?.toString() || ap.planName === plan.name
                                );

                                const directComm = plan.directCommissions?.[0];
                                const directCommVal = directComm ? `${directComm.value}${directComm.type === 'percentage' ? '%' : ''}` : 'Standard';
                                const indirectLevels = plan.indirectCommissions?.length || 0;
                                const totalLevels = indirectLevels > 0 ? `${1 + indirectLevels} Levels` : 'Direct Only (1 Level)';
                                const durationLabel = getPlanDurationText(plan);
                                const directSlotText = plan.directReferralLimit ? `${plan.directReferralLimit} Capacity` : 'Unlimited Capacity';

                                return (
                                    <div 
                                        key={plan._id}
                                        className={`p-5 rounded-2xl border transition-all space-y-4 ${
                                            isMatching
                                            ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/10 border-amber-500/40 shadow-lg'
                                            : isRunning
                                            ? 'bg-emerald-950/20 dark:bg-emerald-950/30 border-emerald-500/40 text-gray-900 dark:text-emerald-100 shadow-md'
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white shadow-sm'
                                        }`}
                                    >
                                        {/* Header: Plan Name, Price, Currency & Badges */}
                                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200/60 dark:border-gray-800 pb-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {isMatching && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                                                            📌 Matching Plan
                                                        </span>
                                                    )}
                                                    {isRunning && (
                                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                                                            ✓ Active Subscription
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-gray-950 dark:text-white">
                                                    {plan.name || 'Investment Plan'}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 block leading-none">
                                                    {formatCurrency(plan.price, plan.currency || currentUser?.currency)}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 block">
                                                    Currency: {plan.currency || currentUser?.currency || 'USD'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Plan Description */}
                                        <div className="bg-amber-500/5 dark:bg-gray-950/70 p-3 rounded-xl border border-amber-500/15 dark:border-gray-800">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block mb-1">
                                                Plan Overview & Scope
                                            </span>
                                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                {plan.description?.trim() 
                                                    ? plan.description 
                                                    : 'Official active investment package to scale daily task income, activate referral bonuses, and elevate withdrawal privileges.'}
                                            </p>
                                        </div>

                                        {/* 4-Column Metric Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Plan Duration</span>
                                                <span className="font-extrabold text-amber-600 dark:text-amber-400">{durationLabel}</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Min Withdraw</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(plan.minWithdraw, plan.currency || currentUser?.currency)}</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Direct Referral</span>
                                                <span className="font-bold text-teal-600 dark:text-teal-400">{directCommVal} Bonus</span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                                                <span className="text-[9px] text-gray-400 uppercase font-black block">Network Depth</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalLevels}</span>
                                            </div>
                                        </div>

                                        {/* Direct Referral Limit & Custom Features */}
                                        <div className="space-y-2 text-xs pt-1 border-t border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-[9px] tracking-wider">Direct Referral Capacity:</span>
                                                <span className="font-black text-gray-800 dark:text-gray-200">{directSlotText}</span>
                                            </div>

                                            {plan.customFeatures && plan.customFeatures.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Custom Features & Privileges:</span>
                                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-gray-700 dark:text-gray-300">
                                                        {plan.customFeatures.map((feat, idx) => (
                                                            <li key={idx} className="flex items-center gap-1.5">
                                                                <span className="text-amber-500 font-black">✓</span> {feat}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Row */}
                                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200/60 dark:border-gray-800">
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Deducts <span className="font-bold text-amber-500">{formatCurrency(plan.price, plan.currency || currentUser?.currency)}</span> from withdrawable balance.
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={() => handleConfirmPurchasePlan(plan)}
                                                disabled={isPurchasingPlan || currentBalance < plan.price}
                                                className="w-full sm:w-auto py-2.5 px-5 rounded-xl font-black uppercase text-xs tracking-wider bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 shrink-0"
                                            >
                                                {isPurchasingPlan ? 'Processing...' : `🛒 Purchase (${formatCurrency(plan.price, plan.currency)})`}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-4 max-h-[26rem] overflow-y-auto pr-1">
                                    {activePlansInUserCurrency.length === 0 ? (
                                        <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800">
                                            No active investment plans found for currency <span className="font-bold">{currentUser?.currency || 'USD'}</span>.
                                        </div>
                                    ) : (
                                        activePlansInUserCurrency.map(plan => renderPlanCard(plan, matchingPlan?._id === plan._id))
                                    )}
                                </div>
                            );
                        })()}

                        {/* BOTTOM ACTION BUTTONS */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setPlanModalTab(planModalTab === 'view_plan' ? 'view_all' : 'view_plan')}
                                className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-all text-center"
                            >
                                {planModalTab === 'view_plan' ? '🌐 View All Plans' : '📌 View Matching Plan'}
                            </button>

                            <Button
                                type="button"
                                onClick={() => setIsPlanOpportunityModalOpen(false)}
                                className="w-full sm:flex-1 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                            >
                                Proceed to Withdraw &rarr;
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* STEP 2: METHOD - REDESIGNED 2 PER ROW, NO LIMIT TEXT */}
                {step === 2 && (
                    <div className="animate-fade-in space-y-4 max-w-2xl mx-auto">
                        <div className="text-center space-y-1 mb-2 sm:mb-4">
                            <h3 className="text-base sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Destination Network</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest opacity-60">Step 2: Choose Payout Provider</p>
                        </div>

                        {withdrawalMethods.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:gap-4 animate-fade-in">
                                {withdrawalMethods.map(method => {
                                    const numAmount = parseFloat(amount);
                                    const minWith = method.minAmount;
                                    const maxWith = method.maxAmount;
                                    const isInvalid = numAmount < minWith || numAmount > maxWith;
                                    
                                    return (
                                        <div 
                                            key={method._id}
                                            onClick={() => {
                                                if (isInvalid) {
                                                    alert(`Limit Violation: This provider only processes requests between ${formatCurrency(minWith, method.currency)} and ${formatCurrency(maxWith, method.currency)}`);
                                                    return;
                                                }
                                                setSelectedMethodId(method._id);
                                                setStep(3);
                                            }}
                                            className={`relative cursor-pointer p-2 sm:p-3 border-2 transition-all duration-300 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-3 bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md ${
                                                isInvalid 
                                                ? 'opacity-40 border-gray-100 dark:border-gray-800 grayscale cursor-not-allowed'
                                                : 'border-gray-150/50 dark:border-gray-800 hover:border-teal-500 dark:hover:border-teal-600 hover:scale-[1.02] active:scale-98'
                                            }`}
                                        >
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-white border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-center p-0.5 shadow-sm">
                                                {method.logoUrl ? (
                                                    <img src={method.logoUrl} alt={method.name} className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <div className="text-teal-600 dark:text-teal-400 font-black text-xl sm:text-2xl uppercase">{method.name.substring(0,1)}</div>
                                                )}
                                            </div>
                                            
                                            <div className="flex-grow min-w-0 w-full">
                                                <h4 className="font-black uppercase text-xs sm:text-base tracking-tight text-gray-950 dark:text-white truncate leading-tight">{method.name}</h4>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 mt-0.5 sm:mt-1">
                                                    {method.feePercent > 0 && (
                                                        <span className="text-[8px] sm:text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mx-auto sm:mx-0">Fee: {method.feePercent}%</span>
                                                    )}
                                                </div>
                                                <span className="text-[8px] sm:text-[9px] font-black text-teal-500 uppercase tracking-widest mt-0.5 sm:mt-1 block">Click to select &rarr;</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800 max-w-lg mx-auto">
                                <p className="text-gray-400 font-black uppercase tracking-widest text-[9px]">No payout providers currently active in your region.</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
                            <button onClick={() => setStep(1)} className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 1
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DETAILS */}
                {step === 3 && selectedMethod && (
                    <div className="animate-fade-in space-y-4 max-w-2xl mx-auto">
                        <div className="text-center space-y-1">
                            <h3 className="text-base sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Settlement Address</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest opacity-60">Step 3: Financial Routing</p>
                        </div>

                        {/* ENLARGED LOGO AND PROVIDER NAME & DETAILS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-center bg-[#0f172a] p-3.5 rounded-2xl border border-gray-800 shadow-xl">
                            <div className="flex items-center gap-3.5">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-md">
                                    {selectedMethod.logoUrl ? (
                                        <img src={selectedMethod.logoUrl} className="max-w-full max-h-full object-contain" alt={selectedMethod.name} />
                                    ) : (
                                        <div className="text-teal-600 dark:text-teal-400 font-black text-lg sm:text-2xl uppercase">{selectedMethod.name.substring(0,1)}</div>
                                    )}
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-[8px] sm:text-[9px] uppercase text-gray-400 font-black tracking-widest mb-0.5">
                                        Chosen Payout Network
                                    </p>
                                    <h3 className="text-sm sm:text-lg font-black text-white leading-tight truncate">{selectedMethod.name}</h3>
                                    <p className="text-[8px] sm:text-[9px] text-teal-400 font-black uppercase tracking-widest mt-0.5">Instant Network Settlement</p>
                                </div>
                            </div>
                            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 text-left">
                                <p className="text-[8px] sm:text-[9px] uppercase text-gray-400 font-black tracking-widest mb-0.5">
                                    Withdrawal Amount
                                </p>
                                <p className="text-sm sm:text-base font-black text-white leading-tight">{formatCurrency(parseFloat(amount), currentUser.currency)}</p>
                            </div>
                        </div>

                        {/* HIGHLY CLEAR PAYMENT MESSAGE */}
                        <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-center">
                            <p className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-400 leading-normal">
                                📢 <strong>Payout Order:</strong> You are requesting to withdraw <strong className="text-xs sm:text-base font-black text-teal-600 dark:text-teal-400 underline">{formatCurrency(parseFloat(amount), currentUser.currency)}</strong> to your <strong>{selectedMethod.name}</strong> account. Please provide precise details below.
                            </p>
                        </div>

                        <div className="bg-[#0f172a] p-4 sm:p-6 rounded-xl sm:rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-teal-600/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

                            <div className="grid grid-cols-2 gap-3 text-left">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-gray-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-1">Gross Allocation</span>
                                    <span className="text-sm sm:text-base font-black text-white">{formatCurrency(parseFloat(amount), currentUser.currency)}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="block text-gray-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-1">Service Fee ({selectedMethod.feePercent}%)</span>
                                    <span className="text-sm sm:text-base font-black text-red-400">-{formatCurrency(fee, currentUser.currency)}</span>
                                </div>
                            </div>

                            <div className="text-center p-4 sm:p-5 bg-teal-600 rounded-xl sm:rounded-2xl shadow-md">
                                <p className="text-[8px] sm:text-[9px] text-teal-100 uppercase tracking-widest font-black mb-0.5">Net Credited Amount</p>
                                <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{formatCurrency(finalAmount, currentUser.currency)}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Receiving Account Holder Name</label>
                                <input 
                                    type="text" 
                                    value={accountTitle}
                                    onChange={e => setAccountTitle(e.target.value)}
                                    className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none font-bold text-xs sm:text-sm"
                                    placeholder="TITLE AS PER BANK"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Receiving Account / Wallet ID</label>
                                <input 
                                    type="text" 
                                    value={accountNumber}
                                    onChange={e => setAccountNumber(e.target.value)}
                                    className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none font-mono font-bold tracking-widest text-xs sm:text-sm"
                                    placeholder="IBAN OR WALLET ID"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Technical Remarks (Optional)</label>
                                <textarea 
                                    value={userNotes}
                                    onChange={e => setUserNotes(e.target.value)}
                                    rows={2}
                                    className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 outline-none text-xs sm:text-sm"
                                    placeholder="Any routing instructions..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-150 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <button onClick={() => setStep(2)} className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 2
                            </button>
                            <Button onClick={() => setStep(4)} disabled={!accountTitle || !accountNumber} className="w-full sm:w-auto px-12 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 border-0 text-white">
                                Review Payout Path &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION */}
                {step === 4 && selectedMethod && (
                    <div className="animate-fade-in space-y-10 max-w-2xl mx-auto">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Transmission Authorization</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest opacity-60">Step 4: Final verification</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 border-2 border-teal-500/20 dark:border-teal-900/50 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-2 h-full bg-teal-600"></div>
                            
                            <div className="flex flex-col gap-10">
                                <div className="flex justify-between items-end border-b dark:border-gray-800 pb-8">
                                    <div>
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Settlement Network</span>
                                        <span className="font-black text-gray-900 dark:text-white text-xl uppercase">{selectedMethod.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Net Credit Value</span>
                                        <span className="font-black text-teal-600 dark:text-teal-400 text-3xl tracking-tighter">{formatCurrency(finalAmount, currentUser.currency)}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-6 bg-white dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-gray-800">
                                        <span className="block text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3">Destination Credentials</span>
                                        <span className="block font-black text-gray-900 dark:text-white text-lg uppercase leading-none mb-2">{accountTitle}</span>
                                        <span className="block font-mono text-base font-bold text-gray-500 dark:text-gray-400 tracking-widest">{accountNumber}</span>
                                    </div>
                                    {userNotes && (
                                        <div className="px-6 italic text-xs text-gray-400 leading-relaxed">
                                            "{userNotes}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* OPTIONAL INVESTMENT PLAN DISCOVERY CALLOUT */}
                        {activePlansInUserCurrency.length > 0 && (
                            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 p-4 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-3 text-left">
                                    <span className="text-2xl">💎</span>
                                    <div>
                                        <p className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Investment Plans Available</p>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">Use your withdrawable funds to buy an investment tier and boost daily earnings.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPlanOpportunityModalOpen(true)}
                                    className="w-full sm:w-auto py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all shrink-0"
                                >
                                    View Plans ({activePlansInUserCurrency.length})
                                </button>
                            </div>
                        )}

                        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <button type="button" onClick={() => setStep(3)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-teal-500 transition-colors">
                                &larr; Return to Step 3
                            </button>
                            <Button type="submit" onClick={handleSubmit} className="w-full sm:w-auto px-20 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-teal-600/30 bg-teal-600 hover:bg-teal-700 border-0" disabled={isSubmitting}>
                                {isSubmitting ? 'Transmitting...' : `Authorize Settlement`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* WITHDRAWAL HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 mt-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Log</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 dark:bg-gray-900 sm:bg-transparent sm:border-none sm:p-0 gap-2 w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Show:</label>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20 py-1 px-2 w-full sm:w-auto"
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
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-teal-500/20 w-full sm:w-auto py-2 sm:py-1.5"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Paid}>Paid</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800 justify-between col-span-2 sm:col-span-1 w-full sm:w-auto">
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

                {paginatedWithdrawals.length > 0 ? (
                    <>
                        <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                            <Table headers={['Date', 'Network', 'Gross', 'Processing', 'Net Credit', 'State']}>
                                {paginatedWithdrawals.map(withdrawal => (
                                    <tr key={withdrawal._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-teal-900/5 transition-colors group">
                                        <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(withdrawal.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{withdrawal.method}</td>
                                        <td className="px-6 py-5 font-bold text-gray-500">{formatCurrency(withdrawal.amount, withdrawal.currency)}</td>
                                        <td className="px-6 py-5 text-xs font-black text-red-500/60 uppercase">-{formatCurrency(withdrawal.fee, withdrawal.currency)}</td>
                                        <td className="px-6 py-5 font-black text-teal-600 dark:text-teal-400 text-base">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</td>
                                        <td className="px-6 py-5">
                                            <Badge status={withdrawal.status === Status.Matching ? Status.Pending : withdrawal.status} />
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </div>

                        {/* Mobile View Settlement Log */}
                        <div className="md:hidden space-y-4">
                            {paginatedWithdrawals.map(withdrawal => (
                                <div key={withdrawal._id} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300">
                                     <div 
                                        className="p-4 flex items-center justify-between cursor-pointer"
                                        onClick={() => setExpandedWithdrawalId(expandedWithdrawalId === withdrawal._id ? null : withdrawal._id)}
                                     >
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{withdrawal.method}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-teal-600 dark:text-teal-400">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</span>
                                                <span className="text-[9px] text-gray-500 line-through">{formatCurrency(withdrawal.amount, withdrawal.currency)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge status={withdrawal.status === Status.Matching ? Status.Pending : withdrawal.status} />
                                            <div className={`w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-teal-500 transition-transform shadow-sm ${expandedWithdrawalId === withdrawal._id ? 'rotate-180' : ''}`}>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                     </div>
                                     
                                     {expandedWithdrawalId === withdrawal._id && (
                                        <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 animate-fade-in text-left">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2 flex justify-between items-center border-b dark:border-gray-800 pb-2">
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{new Date(withdrawal.date).toLocaleString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Processing Fee</p>
                                                        <p className="text-xs font-bold text-red-500">-{formatCurrency(withdrawal.fee, withdrawal.currency)}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Account Title</p>
                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate uppercase">{withdrawal.accountTitle}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Account / ID</p>
                                                    <p className="text-xs font-mono font-bold text-blue-500 truncate select-all">{withdrawal.accountNumber}</p>
                                                </div>
                                                {withdrawal.userNotes && (
                                                    <div className="col-span-2 pt-2 border-t dark:border-gray-800">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Remarks</p>
                                                        <p className="text-[10px] text-gray-500 italic">"{withdrawal.userNotes}"</p>
                                                    </div>
                                                )}
                                                {withdrawal.adminNotes && (
                                                    <div className="col-span-2 pt-2 border-t dark:border-gray-800">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Admin Feedback</p>
                                                        <p className="text-[10px] text-orange-500 font-bold italic">"{withdrawal.adminNotes}"</p>
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
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No settlement history found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawFunds;
