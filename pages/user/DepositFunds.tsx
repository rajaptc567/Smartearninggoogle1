
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentMethod, Status, Withdrawal } from '../../types';
import Button from '../../components/ui/Button';
import { useData } from '../../hooks/useData';
import { createDeposit } from '../../services/api';

const DepositFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { paymentMethods, currentUser, investmentPlans } = state;

    const [selectedMethodId, setSelectedMethodId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [senderAccountTitle, setSenderAccountTitle] = useState('');
    const [receipt, setReceipt] = useState<File | null>(null);
    const [userNotes, setUserNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Get unique prices from active investment plans for the dropdown
    const planPrices = useMemo(() => {
        return investmentPlans
            .filter(p => p.status === Status.Active)
            .map(p => p.price)
            .sort((a, b) => a - b)
            // Filter unique values
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [investmentPlans]);

    // Filter methods based on the selected amount
    const availableMethods = useMemo(() => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return [];

        return paymentMethods.filter(method => 
            method.type === 'Deposit' && 
            method.status === 'Enabled' &&
            method.minAmount <= numericAmount && 
            method.maxAmount >= numericAmount
        );
    }, [paymentMethods, amount]);

    const selectedMethod: PaymentMethod | undefined = useMemo(() =>
        availableMethods.find(method => method._id.toString() === selectedMethodId),
        [selectedMethodId, availableMethods]
    );

    // Reset selected method if amount changes and the previous method is no longer valid
    useEffect(() => {
        if (selectedMethodId && !availableMethods.find(m => m._id === selectedMethodId)) {
            setSelectedMethodId('');
        }
    }, [availableMethods, selectedMethodId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMethod || !amount || !transactionId || !senderAccountTitle || !receipt || !currentUser) {
            alert('Please fill all required fields and upload a receipt.');
            return;
        }
        
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('userId', currentUser._id);
        formData.append('userName', currentUser.username);
        formData.append('method', selectedMethod.name);
        formData.append('amount', amount);
        formData.append('transactionId', transactionId);
        formData.append('senderAccountTitle', senderAccountTitle);
        formData.append('receipt', receipt);
        if(userNotes) formData.append('userNotes', userNotes);
        
        // If this method is linked to a P2P withdrawal, attach the ID so backend handles matching
        if(selectedMethod.p2pWithdrawalId) {
            formData.append('matchedWithdrawalId', selectedMethod.p2pWithdrawalId);
        }

        try {
            const newDeposit = await createDeposit(formData);
            dispatch({ type: 'ADD_DEPOSIT', payload: newDeposit });
            setIsSubmitted(true);
        } catch (error) {
            console.error("Failed to create deposit:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not submit deposit.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
                 <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 flex items-center justify-center">
                    <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold mt-4 text-gray-800 dark:text-white">Deposit Submitted!</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Your deposit request has been received and is now pending admin approval.</p>
                <Button onClick={() => window.location.reload()} className="mt-6">Make Another Deposit</Button>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-1">Deposit Funds</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Select an amount and choose a payment method.</p>
            
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* STEP 1: SELECT AMOUNT */}
                <div>
                    <label htmlFor="amount" className="block text-lg font-medium text-gray-800 dark:text-white mb-2">1. Select Amount</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <select
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="block w-full pl-7 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                        >
                            <option value="">-- Select Amount --</option>
                            {planPrices.map(price => (
                                <option key={price} value={price}>{price.toFixed(2)}</option>
                            ))}
                        </select>
                    </div>
                    {planPrices.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">No active investment plans found.</p>
                    )}
                </div>

                {/* STEP 2: SELECT METHOD (Only shows if amount is selected) */}
                {amount && (
                    <div className="transition-all duration-500 ease-in-out">
                        <label className="block text-lg font-medium text-gray-800 dark:text-white mb-4">2. Select Payment Method</label>
                        
                        {availableMethods.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {availableMethods.map(method => (
                                    <div 
                                        key={method._id}
                                        onClick={() => setSelectedMethodId(method._id)}
                                        className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md
                                            ${selectedMethodId === method._id 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-opacity-50' 
                                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                            }`}
                                    >
                                        {method.logoUrl ? (
                                            <img src={method.logoUrl} alt={method.name} className="h-12 w-auto mb-2 object-contain"/>
                                        ) : (
                                            <div className="h-12 w-12 mb-2 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                            </div>
                                        )}
                                        <span className="font-semibold text-gray-800 dark:text-white">{method.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                                <p className="text-gray-500 dark:text-gray-400">No payment methods available for this amount.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: DETAILS & SUBMIT (Only shows if method is selected) */}
                {selectedMethod && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t dark:border-gray-700 animate-fade-in">
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Payment Details</h3>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Account Title</span>
                                    <span className="block text-base font-semibold text-gray-900 dark:text-white">{selectedMethod.accountTitle}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Account Number</span>
                                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600 mt-1">
                                        <span className="font-mono text-base text-gray-900 dark:text-white truncate">{selectedMethod.accountNumber}</span>
                                        <button 
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(selectedMethod.accountNumber)}
                                            className="ml-2 text-blue-600 hover:text-blue-700 text-xs font-medium"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Instructions</span>
                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                        {selectedMethod.instructions || 'Please transfer the exact amount to the account above.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Confirm Deposit</h3>
                            
                            <div>
                                <label htmlFor="senderAccountTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Account Title</label>
                                <input 
                                    type="text" 
                                    id="senderAccountTitle" 
                                    value={senderAccountTitle} 
                                    onChange={(e) => setSenderAccountTitle(e.target.value)} 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    placeholder="Name on your bank account / wallet"
                                    required 
                                />
                            </div>

                            <div>
                                <label htmlFor="transactionId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction ID / Reference</label>
                                <input 
                                    type="text" 
                                    id="transactionId" 
                                    value={transactionId} 
                                    onChange={(e) => setTransactionId(e.target.value)} 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    placeholder="Enter the transaction ID provided by your bank"
                                    required 
                                />
                            </div>

                            <div>
                                <label htmlFor="receipt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload Receipt</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className="space-y-1 text-center">
                                        {receipt ? (
                                            <div className="flex flex-col items-center">
                                                <svg className="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{receipt.name}</p>
                                                <button type="button" onClick={() => setReceipt(null)} className="text-xs text-red-500 mt-2 font-medium">Remove</button>
                                            </div>
                                        ) : (
                                            <>
                                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                                    <label htmlFor="receipt" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                                        <span>Upload a file</span>
                                                        <input id="receipt" name="receipt" type="file" className="sr-only" onChange={(e) => e.target.files && setReceipt(e.target.files[0])} required />
                                                    </label>
                                                    <p className="pl-1">or drag and drop</p>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="userNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
                                <textarea id="userNotes" value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Additional details..."></textarea>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : `Submit Deposit of $${amount}`}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export default DepositFunds;