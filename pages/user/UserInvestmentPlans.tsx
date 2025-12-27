
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../hooks/useData';
import { InvestmentPlan, Status, currencySymbols, formatCurrency } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useNavigate, useLocation } from 'react-router-dom';
import { purchasePlan as apiPurchasePlan } from '../../services/api';

// --- Icon Components ---
const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
);
const LockIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>;
const CrownIcon = () => <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>;

const UserInvestmentPlans: React.FC = () => {
  const { state, dispatch } = useData();
  const { investmentPlans, currentUser, transactions, settings, rules, users } = state;
  const navigate = useNavigate();
  const location = useLocation();
  const highlightPlanId = location.state?.highlightPlanId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Define themes for cards to cycle through
  const planThemes = [
    {
        name: 'Blue',
        gradient: 'from-blue-500 to-cyan-500',
        bgLight: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
        button: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
        shadow: 'shadow-blue-500/20'
    },
    {
        name: 'Purple',
        gradient: 'from-purple-500 to-pink-500',
        bgLight: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-200',
        button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
        shadow: 'shadow-purple-500/20'
    },
    {
        name: 'Emerald',
        gradient: 'from-emerald-500 to-teal-500',
        bgLight: 'bg-emerald-50',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700',
        shadow: 'shadow-emerald-500/20'
    },
    {
        name: 'Amber',
        gradient: 'from-amber-500 to-orange-500',
        bgLight: 'bg-amber-50',
        text: 'text-amber-600',
        border: 'border-amber-200',
        button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700',
        shadow: 'shadow-amber-500/20'
    }
  ];

  // Effect to scroll to the highlighted plan
  useEffect(() => {
    if (highlightPlanId) {
        setTimeout(() => {
            const element = document.getElementById(`plan-${highlightPlanId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
    }
  }, [highlightPlanId]);

  // Calculate User Stats for Rule Checking
  const userStats = useMemo(() => {
      if (!currentUser) return { totalEarnings: 0, directReferrals: 0 };
      
      const totalEarnings = transactions
          .filter(t => t.userId === currentUser._id && t.type === 'Commission' && t.status === 'Approved')
          .reduce((sum, t) => sum + t.amount, 0);

      const directReferrals = users.filter(u => 
          u.sponsor && u.sponsor.toLowerCase() === currentUser.username.toLowerCase()
      ).length;

      return { totalEarnings, directReferrals };
  }, [currentUser, transactions, users]);

  if (!currentUser) {
    return <div>Loading user data...</div>;
  }
  
  const activePlans = investmentPlans.filter(p => p.status === Status.Active && p.currency === currentUser.currency);

  const handlePurchaseClick = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  }

  const handleConfirmPurchase = async () => {
    if (selectedPlan) {
        setIsPurchasing(true);
        try {
            const result = await apiPurchasePlan(currentUser._id, selectedPlan._id);
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            alert(`${selectedPlan.name} purchased successfully!`);
        } catch (error) {
            console.error('Failed to purchase plan:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not purchase plan.'}`);
        } finally {
            setIsPurchasing(false);
            handleCloseModal();
        }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPlan(null);
  }

  // --- Smart Price Formatter ---
  const formatPrice = (amount: number, currency: string) => {
      const symbol = currencySymbols[currency] || currency;
      // If it's a whole number, don't show decimals
      if (amount % 1 === 0) {
          return `${symbol} ${amount.toLocaleString()}`;
      }
      // Otherwise show standard 2 decimals
      return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderDirectCommission = (plan: InvestmentPlan) => {
      const comms = plan.directCommissions;
      if (!comms || comms.length === 0) return 'N/A';
      let maxVal = 0;
      let maxType: 'percentage' | 'fixed' = 'percentage';
      comms.forEach(c => {
          if (c.value > maxVal) {
              maxVal = c.value;
              maxType = c.type;
          }
      });
      const valStr = maxType === 'percentage' ? `${maxVal}%` : formatPrice(maxVal, plan.currency);
      return comms.length > 1 ? `Up to ${valStr}` : valStr;
  };

  // Helper to calculate total held commission that would be unlocked by buying this plan
  const getHeldCommissionInfo = (planId: string) => {
      const pendingCommissions = transactions.filter(t => 
          t.userId === currentUser._id && 
          t.type === 'Commission' && 
          t.status === 'Pending'
      );

      let totalHeld = 0;
      let count = 0;

      pendingCommissions.forEach(comm => {
          const relatedId = comm.relatedPlanId;
          let isMatch = false;

          if (relatedId) {
                if (relatedId === planId) isMatch = true;
                if (!isMatch && settings.planEquivalencyGroups) {
                    const group = settings.planEquivalencyGroups.find(g => 
                        g.usdPlanId === relatedId || 
                        g.pkrPlanId === relatedId || 
                        g.eurPlanId === relatedId
                    );
                    if (group) {
                        if (group.usdPlanId === planId || group.pkrPlanId === planId || group.eurPlanId === planId) {
                            isMatch = true;
                        }
                    }
                }
          } else {
              isMatch = true; 
          }

          if (isMatch) {
              totalHeld += comm.amount;
              count++;
          }
      });

      return { totalHeld, count };
  };

  // Helper to check rules
  const checkPrerequisites = (planId: string) => {
      const rule = rules.find(r => r.targetPlanId === planId && r.isActive !== false);
      if (!rule) return null;

      const userPlanIds = (currentUser.activePlans || []).map(p => p.planId);
      
      const requiredPlanDetails = rule.requiredPlanIds
          .map(reqId => investmentPlans.find(p => p._id === reqId))
          .filter(Boolean) as InvestmentPlan[];

      const missingPlans = requiredPlanDetails.filter(p => !userPlanIds.includes(p._id));
      const metPlans = requiredPlanDetails.filter(p => userPlanIds.includes(p._id));
      
      // Check Earnings
      const earningShortfall = rule.minTotalEarnings > 0 && userStats.totalEarnings < rule.minTotalEarnings 
          ? rule.minTotalEarnings - userStats.totalEarnings 
          : 0;
          
      const earningExceeded = rule.maxTotalEarnings && rule.maxTotalEarnings > 0 && userStats.totalEarnings > rule.maxTotalEarnings;

      // Check Referrals
      const referralShortfall = rule.minDirectReferrals > 0 && userStats.directReferrals < rule.minDirectReferrals
          ? rule.minDirectReferrals - userStats.directReferrals
          : 0;

      const isLocked = missingPlans.length > 0 || earningShortfall > 0 || !!earningExceeded || referralShortfall > 0;

      return {
          hasRule: true,
          isLocked,
          missingPlans,
          metPlans,
          earningShortfall,
          earningExceeded,
          referralShortfall,
          rule
      };
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-2">
       <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                Choose Your Investment Plan
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Unlock your earning potential with our tailored packages. 
                Invest securely and grow your network today.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6">
            {activePlans.map((plan, index) => {
                const isOwned = currentUser.activePlans && currentUser.activePlans.some(p => p.planId === plan._id);
                const isPopular = index === 1; // Highlight logic (can be made dynamic later)
                const isHighlighted = highlightPlanId === plan._id;
                
                // Select a theme cyclically
                const theme = planThemes[index % planThemes.length];
                
                const { totalHeld, count } = getHeldCommissionInfo(plan._id);
                const prerequisites = checkPrerequisites(plan._id);
                const isLocked = prerequisites?.isLocked;
                const canAfford = currentUser.walletBalance >= plan.price;

                const config = plan.displayConfig || { 
                    showDuration: true, 
                    showMinWithdraw: true, 
                    showDirectCommission: true, 
                    showIndirectCommission: true, 
                    showDirectReferrals: true 
                };

                return (
                     <div 
                        key={plan._id} 
                        id={`plan-${plan._id}`}
                        className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl transition-all duration-300 hover:-translate-y-2
                            ${isHighlighted 
                                ? 'ring-4 ring-yellow-400 dark:ring-yellow-500 scale-105 z-10' 
                                : `hover:shadow-2xl ${theme.shadow}`
                            }`}
                    >
                        {/* Header Gradient */}
                        <div className={`h-2 rounded-t-3xl bg-gradient-to-r ${theme.gradient}`}></div>

                        {/* Popular Badge */}
                        {isPopular && (
                            <div className="absolute top-0 right-0 -mt-3 mr-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-lg bg-gradient-to-r ${theme.gradient}`}>
                                    <CrownIcon />
                                    <span className="ml-1">Best Value</span>
                                </span>
                            </div>
                        )}
                        
                        <div className="p-8 flex-grow flex flex-col">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{plan.name}</h3>
                                <div className="mt-2 flex items-baseline">
                                    <span className={`text-5xl font-extrabold tracking-tight ${theme.text}`}>
                                        {formatPrice(plan.price, plan.currency)}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed min-h-[40px]">
                                    {plan.description}
                                </p>
                            </div>

                            {/* Features List */}
                            <ul className="space-y-4 mb-8 flex-grow">
                                {config.showDuration && (
                                    <li className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Duration:</span> {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}
                                        </span>
                                    </li>
                                )}
                                {config.showMinWithdraw && (
                                    <li className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Min Withdraw:</span> {formatPrice(plan.minWithdraw, plan.currency)}
                                        </span>
                                    </li>
                                )}
                                {config.showDirectReferrals && (
                                    <li className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Direct Referrals:</span> {plan.directReferralLimit === 0 ? 'Unlimited' : `Max ${plan.directReferralLimit}`}
                                        </span>
                                    </li>
                                )}
                                {config.showDirectCommission && (
                                    <li className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Direct Comm:</span> {renderDirectCommission(plan)}
                                        </span>
                                    </li>
                                )}
                                {config.showIndirectCommission && (
                                    <li className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span className="font-semibold">Network:</span> {plan.indirectCommissions.length} Levels Deep
                                        </span>
                                    </li>
                                )}
                                {plan.customFeatures && plan.customFeatures.map((feature, i) => (
                                    <li key={i} className="flex items-start">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${theme.bgLight} dark:bg-gray-700`}>
                                            {/* Using standard check icon for features to maintain clean look */}
                                            <CheckIcon className={`w-4 h-4 ${theme.text}`} />
                                        </div>
                                        <span className="ml-3 text-sm text-gray-700 dark:text-gray-200 font-medium">
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            
                            {/* ALERTS SECTION */}
                            <div className="space-y-3">
                                {/* Rule Lock Alert */}
                                {prerequisites && prerequisites.hasRule && isLocked && !isOwned && (
                                    <div className="p-3 rounded-lg border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200 text-xs">
                                        <div className="flex items-center gap-1 font-bold mb-1 border-b border-red-200 dark:border-red-800 pb-1">
                                            <LockIcon /> Prerequisites Missing
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                            {prerequisites.missingPlans.length > 0 && (
                                                <li>Required Plan{prerequisites.missingPlans.length > 1 ? 's' : ''}: <strong>{prerequisites.missingPlans.map(p => p.name).join(', ')}</strong></li>
                                            )}
                                            {prerequisites.earningShortfall > 0 && (
                                                <li>Earn <strong>{formatCurrency(prerequisites.earningShortfall, currentUser.currency)}</strong> more to unlock</li>
                                            )}
                                            {prerequisites.earningExceeded && (
                                                <li>Max earnings limit reached for this plan</li>
                                            )}
                                            {prerequisites.referralShortfall > 0 && (
                                                <li>Refer <strong>{prerequisites.referralShortfall}</strong> more people</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                
                                {prerequisites && prerequisites.hasRule && !isLocked && !isOwned && (
                                     <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200 text-xs">
                                        <div className="flex items-center gap-1 font-bold">
                                            <CheckIcon className="w-4 h-4" /> Prerequisites Met
                                        </div>
                                    </div>
                                )}

                                {/* Held Commission Alert */}
                                {totalHeld > 0 && !isOwned && !isLocked && (
                                    <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-200 text-xs animate-pulse">
                                        <div className="font-bold flex items-center gap-1">
                                            <span className="text-lg">💰</span> Commission Held!
                                        </div>
                                        <div>Purchase to unlock <strong>{formatPrice(totalHeld, currentUser.currency)}</strong>.</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="p-6 pt-0 mt-auto">
                           {isOwned ? (
                               <button disabled className="w-full py-3 px-4 rounded-xl font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed flex items-center justify-center gap-2">
                                   <CheckIcon className="w-5 h-5" /> Active Plan
                               </button>
                           ) : isLocked ? (
                               <button disabled className="w-full py-3 px-4 rounded-xl font-bold text-white bg-gray-400 cursor-not-allowed flex items-center justify-center gap-2">
                                   <LockIcon /> Locked
                               </button>
                           ) : canAfford ? (
                               <button 
                                    onClick={() => handlePurchaseClick(plan)}
                                    className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 ${theme.button}`}
                                >
                                   {totalHeld > 0 ? 'Unlock & Purchase' : 'Get Started'}
                               </button>
                           ) : (
                               <button 
                                    onClick={() => navigate('/member/deposit')}
                                    className="w-full py-3 px-4 rounded-xl font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
                                >
                                   Deposit to Buy
                               </button>
                           )}
                        </div>
                    </div>
                )
            })}
        </div>

        {isModalOpen && selectedPlan && (
            <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                <div className="p-6 text-center max-w-md mx-auto">
                    <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-3xl">
                        🛒
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Confirm Purchase</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        You are about to purchase the <span className="font-bold text-blue-600 dark:text-blue-400">{selectedPlan.name}</span> plan.
                    </p>
                    
                    {currentUser.walletBalance >= selectedPlan.price ? (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 mb-6">
                             <div className="flex justify-between text-sm mb-2">
                                 <span className="text-gray-500 dark:text-gray-400">Current Balance</span>
                                 <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(currentUser.walletBalance, currentUser.currency)}</span>
                             </div>
                             <div className="flex justify-between text-sm mb-2">
                                 <span className="text-gray-500 dark:text-gray-400">Plan Cost</span>
                                 <span className="font-semibold text-red-500">-{formatPrice(selectedPlan.price, selectedPlan.currency)}</span>
                             </div>
                             <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                             <div className="flex justify-between text-base font-bold">
                                 <span className="text-gray-800 dark:text-gray-200">New Balance</span>
                                 <span className="text-green-600 dark:text-green-400">{formatPrice((currentUser.walletBalance - selectedPlan.price), currentUser.currency)}</span>
                             </div>
                        </div>
                    ) : (
                         <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800 mb-6">
                            <p className="text-sm text-red-700 dark:text-red-300">
                                Insufficient balance. You need <span className="font-bold">{formatPrice((selectedPlan.price - currentUser.walletBalance), currentUser.currency)}</span> more.
                            </p>
                         </div>
                    )}
                    
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={handleCloseModal} disabled={isPurchasing} className="flex-1">Cancel</Button>
                        {currentUser.walletBalance >= selectedPlan.price ? (
                            <Button variant="success" onClick={handleConfirmPurchase} disabled={isPurchasing} className="flex-1">
                                {isPurchasing ? 'Processing...' : 'Confirm & Pay'}
                            </Button>
                        ) : (
                             <Button variant="primary" onClick={() => navigate('/member/deposit')} className="flex-1">
                                Go to Deposit
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default UserInvestmentPlans;
