
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Withdrawal, formatCurrency } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createWithdrawal } from '../../services/api';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const WithdrawFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, paymentMethods, withdrawals, settings: { restrictWithdrawalAmount, withdrawalFrequency } } = state;
    const navigate = useNavigate();

    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [accountTitle, setAccountTitle] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

    const withdrawalMethods = useMemo(() => {
        if (!currentUser) return [];
        return paymentMethods.filter(method => 
            method.type === 'Withdrawal' && 
            method.status === 'Enabled' &&
            method.currency === currentUser.currency
        );
    }, [paymentMethods, currentUser]);
    
    // FILTER: Use the CURRENT USER'S active plans if restriction is enabled
    const userActivePlanPrices = useMemo(() => {
        if (!currentUser?.activePlans) return [];
        return [...new Set(currentUser.activePlans.map(p => p.price))]
            .sort((a: number, b: number) => a - b);
    }, [currentUser]);

    const selectedMethod: PaymentMethod | undefined = useMemo(() =>
        withdrawalMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, withdrawalMethods]
    );

    // User Withdrawal History
    const userWithdrawals = useMemo(() => {
        if (!currentUser) return [];
        return withdrawals
            .filter(w => w.userId === currentUser._id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [withdrawals, currentUser]);

    // CHECK FREQUENCY: Calculate if user is allowed to withdraw right now
    useEffect(() => {
        if (currentUser && withdrawalFrequency?.enabled) {
            // Filter withdrawals for this user, find the latest one
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
                    
                    setCooldownMessage(`Withdrawals are limited to one every ${value} ${unit}. You can request again in ${days}d ${hours}h ${minutes}m.`);
                } else {
                    setCooldownMessage(null);
                }
            }
        } else {
            setCooldownMessage(null);
        }
    }, [currentUser, withdrawals, withdrawalFrequency]);


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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);

        if (!currentUser) return alert('User not found.');
        if (!selectedMethod || isNaN(numericAmount) || !accountTitle || !accountNumber) {
            return alert('Please fill all required fields.');
        }
        if (numericAmount > currentUser.walletBalance) {
            return alert("Withdrawal amount cannot exceed your wallet balance.");
        }
        if (numericAmount < selectedMethod.minAmount || numericAmount > selectedMethod.maxAmount) {
            return alert(`Amount must be between ${formatCurrency(selectedMethod.minAmount, selectedMethod.currency)} and ${formatCurrency(selectedMethod.maxAmount, selectedMethod.currency)}.`);
        }
        if (cooldownMessage) {
            return alert("You are currently restricted from withdrawing. Please wait for the cooldown period to end.");
        }
        
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
            };

            const result = await createWithdrawal(withdrawalData);
            dispatch({ type: 'ADD_WITHDRAWAL', payload: result.withdrawal });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });
            setIsSubmitted(true);

        } catch (error) {
             console.error("Failed to submit withdrawal request:", error);
             alert(`Error: ${error instanceof Error ? error.message : 'Could not submit request.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) return <div>Loading...</div>;

    if (isSubmitted) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 flex items-center justify-center">
                    <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold mt-4 text-gray-800 dark:text-white">Withdrawal Request Submitted!</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Your request has been received and is now pending admin approval.</p>
                <Button onClick={() => window.location.reload()} className="mt-6">Make Another Withdrawal</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="text-center mb-6 border-b dark:border-gray-700 pb-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Wallet Balance</p>
                    <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                </div>

                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Request Withdrawal</h2>

                {cooldownMessage && (
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-bold flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Withdrawal Cooldown Active
                        </p>
                        <p className="mt-1">{cooldownMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className={`space-y-4 ${cooldownMessage ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label htmlFor="withdrawMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Withdrawal Method</label>
                        <select id="withdrawMethod" value={selectedMethodId} onChange={(e) => setSelectedMethodId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                            <option value="">-- Choose a method --</option>
                            {withdrawalMethods.map(method => (
                                <option key={method._id} value={method._id}>{method.name}</option>
                            ))}
                        </select>
                         {withdrawalMethods.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">No withdrawal methods available for your currency ({currentUser.currency}).</p>
                        )}
                    </div>

                    {selectedMethod && (
                        <div className="space-y-4 transition-all duration-500 ease-in-out">
                             <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount to Withdraw</label>
                                {restrictWithdrawalAmount ? (
                                    <>
                                        <select id="amount" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" required>
                                            <option value="">-- Select plan amount --</option>
                                            {userActivePlanPrices.map(price => <option key={price} value={price}>{formatCurrency(price, currentUser.currency)}</option>)}
                                        </select>
                                        {userActivePlanPrices.length === 0 && (
                                            <div className="mt-2 text-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-md">
                                                <p className="text-sm text-yellow-800 dark:text-yellow-200">You have to buy any plan to withdraw your funds.</p>
                                                <Button size="sm" onClick={() => navigate('/member/plans')} className="mt-2">
                                                    Buy a Plan Now
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Min ${formatCurrency(selectedMethod.minAmount, selectedMethod.currency)}, Max ${formatCurrency(selectedMethod.maxAmount, selectedMethod.currency)}`} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" required />
                                )}
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-300">Service Fee ({selectedMethod.feePercent}%):</span>
                                    <span className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(fee, currentUser.currency)}</span>
                                </div>
                                <div className="flex justify-between mt-1 font-bold">
                                    <span className="text-gray-800 dark:text-white">You Will Receive:</span>
                                    <span className="text-green-600 dark:text-green-400">{formatCurrency(finalAmount, currentUser.currency)}</span>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="accountTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Account Title</label>
                                <input type="text" id="accountTitle" value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} placeholder="e.g., John Doe" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" required />
                            </div>

                            <div>
                                <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Account Number / Wallet Address</label>
                                <input type="text" id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" required />
                            </div>

                             <div>
                                <label htmlFor="userNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Instructions (Optional)</label>
                                <textarea id="userNotes" value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="Add any special instructions for the admin..."></textarea>
                            </div>
                        </div>
                    )}
                     {selectedMethod && (
                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={isSubmitting || !!cooldownMessage}>{isSubmitting ? 'Submitting...' : 'Submit Withdrawal Request'}</Button>
                        </div>
                     )}
                </form>
            </div>

            {/* WITHDRAWAL HISTORY SECTION */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">My Withdrawal History</h3>
                {userWithdrawals.length > 0 ? (
                    <Table headers={['Date', 'Method', 'Amount', 'Fee', 'Net Received', 'Status']}>
                        {userWithdrawals.map(withdrawal => (
                            <tr key={withdrawal._id} className="text-gray-700 dark:text-gray-400">
                                <td className="px-4 py-3 text-sm">{new Date(withdrawal.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm">{withdrawal.method}</td>
                                <td className="px-4 py-3 font-semibold">{formatCurrency(withdrawal.amount, withdrawal.currency)}</td>
                                <td className="px-4 py-3 text-sm text-red-500">-{formatCurrency(withdrawal.fee, withdrawal.currency)}</td>
                                <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</td>
                                <td className="px-4 py-3"><Badge status={withdrawal.status} /></td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No withdrawal history found.</p>
                )}
            </div>
        </div>
    );
};

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


export default WithdrawFunds;
