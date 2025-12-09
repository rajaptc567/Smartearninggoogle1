
import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { InvestmentPlan, Status, formatCurrency } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useNavigate, useLocation } from 'react-router-dom';
import { purchasePlan as apiPurchasePlan } from '../../services/api';

// --- Icon Components ---
const ClockIcon = () => <svg className="w-6 h-6 mr-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const DollarIcon = () => <svg className="w-6 h-6 mr-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-2m0 2v.01m0-2.01V10m0 2v2m0-2v.01M12 6.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"></path></svg>;
const UsersIcon = () => <svg className="w-6 h-6 mr-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const StarIcon = () => <svg className="w-6 h-6 mr-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>;
const CheckMarkIcon = () => <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;

const UserInvestmentPlans: React.FC = () => {
  const { state, dispatch } = useData();
  const { investmentPlans, currentUser, transactions, settings } = state;
  const navigate = useNavigate();
  const location = useLocation();
  const highlightPlanId = location.state?.highlightPlanId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

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
      const valStr = maxType === 'percentage' ? `${maxVal}%` : formatCurrency(maxVal, plan.currency);
      return `Up to ${valStr}`;
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
          // Generally check if this pending commission is because of a missing plan
          // Currently we only track relatedPlanId on commission transaction if logic allows
          const relatedId = comm.relatedPlanId;
          
          // If commission is pending but has no related plan, it might be due to 'Active Plan Required' check
          // In that case, buying ANY plan might unlock it.
          // BUT if we want to be specific:
          
          let isMatch = false;

          if (relatedId) {
                // 1. Direct Match: The commission is tied to this specific plan
                if (relatedId === planId) isMatch = true;

                // 2. Equivalency Match: The commission is tied to a plan equivalent to this one
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
              // If no relatedPlanId, assume it's held due to 'RequireActivePlan' generic rule
              // So buying ANY plan helps. We can show it on all plans or logic can be refined.
              // For now, let's assume relatedPlanId is populated for commissions held due to Plan Matching.
              // If held due to 'Active Plan Required', relatedPlanId might still be present from the purchase.
              isMatch = true; // Show on all plans if generic? Or logic above handles it via relatedPlanId?
              // Let's stick to relatedPlanId check for specificity as per request.
          }

          if (isMatch) {
              totalHeld += comm.amount;
              count++;
          }
      });

      return { totalHeld, count };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
       <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Investment Plans</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">Choose a plan to start earning or upgrade to unlock greater potential.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
            {activePlans.map((plan, index) => {
                const isOwned = currentUser.activePlans && currentUser.activePlans.some(p => p.planId === plan._id);
                const canAfford = currentUser.walletBalance >= plan.price;
                const isPopular = index === 1; // Static example to highlight a plan
                const isHighlighted = highlightPlanId === plan._id;
                
                const { totalHeld, count } = getHeldCommissionInfo(plan._id);

                return (
                     <div 
                        key={plan._id} 
                        id={`plan-${plan._id}`}
                        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg flex flex-col border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 
                            ${isHighlighted 
                                ? 'border-yellow-500 ring-4 ring-yellow-500/30 transform scale-105 z-10' 
                                : isPopular 
                                    ? 'border-blue-500' 
                                    : 'border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        {isPopular && <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full z-10 tracking-wider uppercase">Most Popular</div>}
                        
                        <div className="p-8 flex-grow flex flex-col">
                            <div className="text-center mb-6">
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                                <p className="text-6xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">{formatCurrency(plan.price, plan.currency)}</p>
                            </div>
                            
                            {totalHeld > 0 && !isOwned && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 mb-4 rounded-lg animate-pulse">
                                    <div className="flex items-start">
                                        <svg className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        <div>
                                            <p className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Commission Held!</p>
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                                Purchase this plan to instantly unlock <strong>{formatCurrency(totalHeld, currentUser.currency)}</strong> in held commissions from {count} referral(s).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-base text-gray-600 dark:text-gray-300 text-center mb-8">{plan.description}</p>
                            
                            <ul className="space-y-5 text-base text-gray-600 dark:text-gray-300 flex-grow mb-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                                <li className="flex items-center"><ClockIcon /> <div><span className="font-semibold">Duration:</span> {plan.durationDays === 0 ? 'Unlimited' : `${plan.durationDays} Days`}</div></li>
                                <li className="flex items-center"><DollarIcon /> <div><span className="font-semibold">Min. Withdraw:</span> {formatCurrency(plan.minWithdraw, plan.currency)}</div></li>
                                <li className="flex items-center"><UsersIcon /> <div><span className="font-semibold">Direct Referrals:</span> {plan.directReferralLimit === 0 ? 'Unlimited' : `Up to ${plan.directReferralLimit}`}</div></li>
                                <li className="flex items-center"><StarIcon /> <div><span className="font-semibold">Direct Commission: </span> {renderDirectCommission(plan)}</div></li>
                                <li className="flex items-center"><UsersIcon /> <div><span className="font-semibold">Indirect Levels: </span> {plan.indirectCommissions.length}</div></li>
                            </ul>
                        </div>
                        
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl mt-auto">
                           {isOwned ? (
                               <Button size="lg" className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 focus:ring-green-500" disabled>
                                   <CheckMarkIcon /> Plan is Active
                               </Button>
                           ) : canAfford ? (
                               <Button size="lg" className="w-full shadow-lg shadow-blue-500/30" onClick={() => handlePurchaseClick(plan)}>
                                   {totalHeld > 0 ? 'Unlock Commissions & Purchase' : 'Purchase Plan'}
                               </Button>
                           ) : (
                               <Button size="lg" className="w-full" variant="secondary" onClick={() => navigate('/member/deposit')}>
                                   Deposit to Purchase
                               </Button>
                           )}
                        </div>
                    </div>
                )
            })}
        </div>

        {isModalOpen && selectedPlan && (
            <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                <div className="p-6 text-center max-w-md">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Confirm Purchase</h2>
                    <p className="my-3 text-gray-600 dark:text-gray-300">You are about to purchase the <span className="font-bold text-blue-500">{selectedPlan.name}</span> plan.</p>
                    
                    {currentUser.walletBalance >= selectedPlan.price ? (
                        <div>
                             <div className="my-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2 border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between text-lg"><span className="text-gray-500">Current Balance:</span> <span className="font-semibold">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</span></div>
                                <div className="flex justify-between text-lg"><span className="text-gray-500">Plan Cost:</span> <span className="font-semibold text-red-500">-{formatCurrency(selectedPlan.price, selectedPlan.currency)}</span></div>
                                <div className="flex justify-between text-xl font-bold pt-2 border-t dark:border-gray-600"><span className="text-gray-800 dark:text-white">New Balance:</span> <span className="text-green-600">{formatCurrency((currentUser.walletBalance - selectedPlan.price), currentUser.currency)}</span></div>
                            </div>
                             <div className="mt-8 flex justify-center space-x-4">
                                <Button variant="secondary" onClick={handleCloseModal} disabled={isPurchasing} className="w-full">Cancel</Button>
                                <Button variant="success" onClick={handleConfirmPurchase} disabled={isPurchasing} className="w-full">
                                    {isPurchasing ? 'Processing...' : 'Confirm & Pay'}
                                </Button>
                             </div>
                        </div>
                    ) : (
                         <div>
                            <p className="my-6 p-4 rounded-md bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                                Your balance of <span className="font-bold">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</span> is insufficient. Please deposit at least <span className="font-bold">{formatCurrency((selectedPlan.price - currentUser.walletBalance), currentUser.currency)}</span> to proceed.
                            </p>
                            <div className="mt-8 flex justify-center space-x-4">
                                <Button variant="secondary" onClick={handleCloseModal} className="w-full">Cancel</Button>
                                <Button variant="primary" onClick={() => navigate('/member/deposit')} className="w-full">Go to Deposit</Button>
                            </div>
                         </div>
                    )}
                </div>
            </Modal>
        )}
    </div>
  );
};

export default UserInvestmentPlans;
