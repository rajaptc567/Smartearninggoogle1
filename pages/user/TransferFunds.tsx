import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { createTransfer, getUsers } from '../../services/api';
import { formatCurrency, User, currencySymbols, Currency, Transfer, Status, TransferFeeTier } from '../../types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const ShieldExclamationIcon = () => (
    <svg className="w-20 h-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Recipient', 'Amount', 'Confirm'];
    return (
        <div className="flex items-center justify-between mb-10 w-full max-w-md mx-auto px-4 relative">
             <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-0 hidden sm:block"></div>
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                    <div key={label} className="flex flex-col items-center relative z-10">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 transform ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-teal-500/40 scale-110' : isCompleted ? 'bg-green-50 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}`}>
                            {isCompleted ? '✓' : stepNum}
                        </div>
                        <span className={`text-[10px] mt-3 font-black uppercase tracking-[0.1em] transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-500' : 'text-gray-400'}`}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const TransferFunds: React.FC = () => {
    const { state, dispatch } = useData();
    const { currentUser, settings, users, transfers } = state;
    const navigate = useNavigate();

    // Wizard State
    const [step, setStep] = useState(1);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [foundRecipient, setFoundRecipient] = useState<User | null>(null);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Downline Filter State
    const [downlineStatusFilter, setDownlineStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [downlineLevelFilter, setDownlineLevelFilter] = useState<string>('all');

    // History Filter State
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatus, setHistoryStatus] = useState<string>('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // --- DOWNLINE CALCULATION ---
    const myDownline = useMemo(() => {
        if (!currentUser) return [];
        
        const buildFlatDownline = (sponsorUsername: string, level: number): { user: User, level: number }[] => {
            const children = users.filter(u => u.sponsor?.toLowerCase() === sponsorUsername.toLowerCase());
            let results: { user: User, level: number }[] = [];
            
            children.forEach(child => {
                results.push({ user: child, level });
                results = results.concat(buildFlatDownline(child.username, level + 1));
            });
            return results;
        };

        return buildFlatDownline(currentUser.username, 1);
    }, [currentUser, users]);

    // Available levels for filtering
    const availableLevels = useMemo(() => {
        // FIX: Explicitly typing sort function parameters as numbers to resolve arithmetic operation errors on line 85.
        // This ensures the TypeScript compiler correctly identifies 'a' and 'b' as numeric types.
        const levels = Array.from(new Set(myDownline.map(d => d.level))).sort((a: number, b: number) => a - b);
        return levels;
    }, [myDownline]);

    // Filter downline based on multiple criteria
    const filteredDownline = useMemo(() => {
        return myDownline.filter(item => {
            // Keyword match
            if (recipientSearch) {
                const term = recipientSearch.toLowerCase();
                const matchesSearch = item.user.username.toLowerCase().includes(term) || 
                                     item.user.fullName.toLowerCase().includes(term);
                if (!matchesSearch) return false;
            }

            // Level match
            if (downlineLevelFilter !== 'all') {
                if (item.level.toString() !== downlineLevelFilter) return false;
            }

            // Account Status match (Active Plan vs No Plan)
            if (downlineStatusFilter !== 'all') {
                const hasPlan = item.user.activePlans && item.user.activePlans.length > 0;
                if (downlineStatusFilter === 'active' && !hasPlan) return false;
                if (downlineStatusFilter === 'inactive' && hasPlan) return false;
            }

            return true;
        });
    }, [myDownline, recipientSearch, downlineLevelFilter, downlineStatusFilter]);

    // Fee Logic
    const transferFeeInfo = useMemo(() => {
        if (!currentUser || !amount || isNaN(parseFloat(amount))) return { fee: 0, total: 0 };
        const numAmount = parseFloat(amount);
        const config = settings.transferConfig;
        
        // Find matching tier
        const tier = config.tiers.find(t => 
            t.currency === currentUser.currency && 
            numAmount >= t.minAmount && 
            numAmount <= t.maxAmount &&
            t.enabled !== false
        );

        if (!tier) return { fee: 0, total: numAmount, noTier: true };

        const fee = tier.feeType === 'percentage' ? (numAmount * tier.feeValue) / 100 : tier.feeValue;
        return { fee, total: numAmount + fee, noTier: false };
    }, [amount, currentUser, settings.transferConfig]);

    // Recipient Verification Logic
    useEffect(() => {
        if (recipientSearch.length >= 3) {
            const term = recipientSearch.toLowerCase();
            const match = users.find(u => 
                (u.username.toLowerCase() === term || u._id.toString() === term) &&
                u._id !== currentUser?._id
            );
            
            if (match) {
                // Check cross-currency restriction
                if (match.currency !== currentUser?.currency && !settings.transferConfig.allowCrossCurrency) {
                    setFoundRecipient(null);
                } else {
                    setFoundRecipient(match);
                }
            } else {
                setFoundRecipient(null);
            }
        } else {
            setFoundRecipient(null);
        }
    }, [recipientSearch, users, currentUser, settings.transferConfig.allowCrossCurrency]);

    const handleSelectRecipient = (user: User) => {
        setRecipientSearch(user.username);
        setFoundRecipient(user);
    };

    const handleAuthorize = async () => {
        if (!foundRecipient || !amount || !currentUser) return;
        setIsSubmitting(true);
        try {
            const result = await createTransfer({
                senderId: currentUser._id,
                recipientId: foundRecipient._id,
                amount: parseFloat(amount)
            });
            dispatch({ type: 'ADD_TRANSFER', payload: result.transfer });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            alert('Transfer authorization request submitted for processing.');
            setStep(1);
            setRecipientSearch('');
            setAmount('');
        } catch (error) {
            alert(`Transfer Failed: ${error instanceof Error ? error.message : 'Technical error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTransfers = useMemo(() => {
        if (!currentUser) return [];
        return transfers
            .filter(t => {
                if (t.senderId !== currentUser._id && t.recipientId !== currentUser._id) return false;
                
                if (historyStatus && t.status !== historyStatus) return false;

                if (historySearch) {
                    const term = historySearch.toLowerCase();
                    const matches = 
                        t._id.toLowerCase().includes(term) ||
                        t.senderName.toLowerCase().includes(term) ||
                        t.recipientName.toLowerCase().includes(term);
                    if (!matches) return false;
                }

                if (historyDateFrom || historyDateTo) {
                    const itemDate = new Date(t.date).setHours(0,0,0,0);
                    const from = historyDateFrom ? new Date(historyDateFrom).setHours(0,0,0,0) : null;
                    const to = historyDateTo ? new Date(historyDateTo).setHours(23,59,59,999) : null;
                    if (from && itemDate < from) return false;
                    if (to && itemDate > to) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transfers, currentUser, historyStatus, historyDateFrom, historyDateTo, historySearch]);

    const paginatedHistory = filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (!currentUser) return null;
    
    // Safety Wall
    if (currentUser.restrictions?.transfer || !settings.transferConfig.enabled) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border dark:border-gray-700 max-w-3xl mx-auto">
                <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center mb-8">
                    <ShieldExclamationIcon />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">Transfers Restricted</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-4 max-w-md leading-relaxed">Internal liquidity movement is currently disabled for this account by platform security.</p>
                <Button variant="secondary" className="mt-10 px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs" onClick={() => navigate('/member')}>Return to Hub</Button>
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-16 px-2">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-none">Internal Transfer</h1>
                        <p className="text-blue-50 text-sm md:text-base max-w-md leading-relaxed font-medium">Instantly send wallet funds to other community members across the network.</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 text-center min-w-[220px] shadow-inner">
                        <p className="text-[10px] text-blue-200 uppercase tracking-[0.3em] font-black mb-1">Available to Send</p>
                        <p className="text-3xl font-black tracking-tighter">{formatCurrency(currentUser.walletBalance, currentUser.currency)}</p>
                    </div>
                </div>
            </div>

            <StepIndicator currentStep={step} />

            {/* Wizard Container */}
            <div className="bg-white dark:bg-gray-950 p-8 sm:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800 min-h-[400px]">
                {step === 1 && (
                    <div className="animate-fade-in max-w-3xl mx-auto space-y-8">
                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Identify Recipient</h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Step 1: Network Target Selection</p>
                        </div>
                        
                        <div className="relative">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-2">Manual User Entry</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input 
                                    value={recipientSearch}
                                    onChange={e => setRecipientSearch(e.target.value)}
                                    className="w-full pl-12 pr-6 py-5 rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-bold focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
                                    placeholder="Type username for manual entry or search below..."
                                />
                            </div>
                            
                            {/* NEW: Filter UI for Downline Pick List */}
                            <div className="mt-8">
                                <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                        Network Directory
                                    </h4>
                                    
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {/* Status Filter */}
                                        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 border dark:border-gray-800">
                                            {[
                                                { id: 'all', label: 'All' },
                                                { id: 'active', label: 'Active' },
                                                { id: 'inactive', label: 'Inactive' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setDownlineStatusFilter(opt.id as any)}
                                                    className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${downlineStatusFilter === opt.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-blue-500'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Level Filter Dropdown */}
                                        <select
                                            value={downlineLevelFilter}
                                            onChange={e => setDownlineLevelFilter(e.target.value)}
                                            className="bg-gray-100 dark:bg-gray-900 border-none rounded-xl text-[9px] font-black uppercase text-gray-400 px-4 py-1.5 focus:ring-blue-500"
                                        >
                                            <option value="all">All Levels</option>
                                            {availableLevels.map(lvl => (
                                                <option key={lvl} value={lvl.toString()}>Level {lvl}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar pb-2">
                                    {filteredDownline.length > 0 ? filteredDownline.map((item) => {
                                        const isSelected = recipientSearch.toLowerCase() === item.user.username.toLowerCase();
                                        const hasActivePlan = item.user.activePlans && item.user.activePlans.length > 0;
                                        
                                        return (
                                            <button
                                                key={item.user._id}
                                                type="button"
                                                onClick={() => handleSelectRecipient(item.user)}
                                                className={`flex flex-col p-4 rounded-[1.5rem] border-2 transition-all text-left group relative
                                                    ${isSelected 
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-xl scale-[1.02] z-10' 
                                                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-500/50 hover:shadow-lg'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 w-full mb-3">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm
                                                        ${isSelected 
                                                            ? 'bg-white/20' 
                                                            : 'bg-white dark:bg-black/40 text-blue-600'
                                                        }`}>
                                                        {item.user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <p className={`text-xs font-black truncate uppercase tracking-tight ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                            {item.user.username}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                                                isSelected
                                                                ? 'bg-white/20 text-white'
                                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                                            }`}>
                                                                Level {item.level}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center mt-auto border-t pt-3 dark:border-white/5">
                                                    <div className="flex items-center gap-1">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${hasActivePlan ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                        <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                                            {hasActivePlan ? 'Active' : 'No Plan'}
                                                        </span>
                                                    </div>
                                                    <Badge status={item.user.status as Status} />
                                                </div>
                                            </button>
                                        );
                                    }) : (
                                        <div className="col-span-full py-16 text-center bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                                            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
                                            <p className="text-gray-400 font-black text-xs uppercase tracking-[0.2em]">No matching network members</p>
                                            <p className="text-[10px] text-gray-500 mt-2">Try adjusting your filters or search term</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Manual Entry Verification View */}
                            {recipientSearch.length >= 3 && (
                                <div className="mt-8 p-8 rounded-[2.5rem] border-2 border-blue-500/20 transition-all animate-slide-up bg-[#0f172a] text-white shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    {foundRecipient ? (
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-lg border border-blue-400/30">
                                                    {foundRecipient.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] mb-1">Target Account Verified</p>
                                                    <p className="text-xl font-black uppercase leading-tight">{foundRecipient.fullName}</p>
                                                    <p className="text-xs font-bold text-gray-400 mt-1">@{foundRecipient.username}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-3">
                                                <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Secure Path</div>
                                                <Badge status={foundRecipient.status as Status} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 relative z-10">
                                            <p className="text-lg text-red-400 font-black uppercase tracking-tighter">No Verified Destination Found</p>
                                            <p className="text-[10px] text-gray-500 mt-2 uppercase font-black tracking-widest italic">Please double check the username accuracy</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <Button 
                                className="w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-blue-500/30 transition-all active:scale-[0.98]" 
                                disabled={!foundRecipient}
                                onClick={() => setStep(2)}
                            >
                                Allocate Funds &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {step === 2 && foundRecipient && (
                    <div className="animate-fade-in max-w-xl mx-auto space-y-8">
                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Transfer Amount</h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Step 2: Capital Allocation</p>
                        </div>

                        <div className="space-y-6">
                            <div className="relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-2">Amount to Send ({currentUser.currency})</label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-gray-400 font-black text-xl group-focus-within:text-blue-500 transition-colors">
                                        {currencySymbols[currentUser.currency]}
                                    </span>
                                    <input 
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full pl-12 p-6 rounded-2xl dark:bg-gray-900 border-gray-100 dark:border-gray-800 font-black text-4xl tracking-tighter focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Financial Breakdown */}
                            <div className="p-10 bg-[#0f172a] rounded-[3rem] text-white shadow-2xl border border-white/5 space-y-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                <div className="flex justify-between items-center text-sm relative z-10">
                                    <span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">Processing Fee</span>
                                    <span className="font-black text-red-400">+{formatCurrency(transferFeeInfo.fee, currentUser.currency)}</span>
                                </div>
                                <div className="h-px bg-white/5 relative z-10"></div>
                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <span className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px] block mb-1">Total Deduction</span>
                                        <span className="text-4xl font-black tracking-tighter">{formatCurrency(transferFeeInfo.total, currentUser.currency)}</span>
                                    </div>
                                    {transferFeeInfo.noTier && (
                                        <div className="bg-red-500/20 border border-red-500/40 px-4 py-2 rounded-xl text-[9px] text-red-400 font-black uppercase tracking-widest animate-pulse">
                                            Outside Tier Limits
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setStep(1)} className="flex-1 py-5 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 transition-colors">Return to Recipient</button>
                            <Button 
                                className="flex-[2] py-5 rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-blue-500/20" 
                                disabled={!amount || parseFloat(amount) <= 0 || transferFeeInfo.total > currentUser.walletBalance || transferFeeInfo.noTier}
                                onClick={() => setStep(3)}
                            >
                                Review Payout Path &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {step === 3 && foundRecipient && (
                    <div className="animate-fade-in max-w-xl mx-auto space-y-8">
                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Authorize Transfer</h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Step 3: Signature & Transmission</p>
                        </div>

                        <div className="p-10 bg-gray-50 dark:bg-gray-900 rounded-[3rem] border-2 border-blue-500/10 space-y-10 relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                            
                            <div className="flex items-center gap-6 pb-8 border-b dark:border-gray-800">
                                <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-gray-800 shadow-xl flex items-center justify-center text-4xl border dark:border-gray-700">👤</div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Destination Counterparty</p>
                                    <h4 className="text-2xl font-black uppercase tracking-tight">{foundRecipient.fullName}</h4>
                                    <p className="text-sm font-bold text-blue-500">@{foundRecipient.username}</p>
                                </div>
                                <div className="ml-auto">
                                    <Badge status={foundRecipient.status as Status} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Net Send Value</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{formatCurrency(parseFloat(amount), currentUser.currency)}</p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Wallet Deduction</p>
                                    <p className="text-3xl font-black text-red-500 tracking-tighter">-{formatCurrency(transferFeeInfo.total, currentUser.currency)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4">
                            <Button 
                                className="w-full py-6 rounded-[1.5rem] font-black uppercase tracking-[0.4em] text-xs shadow-3xl shadow-blue-500/30 bg-blue-600 hover:bg-blue-700 border-0 transition-all active:scale-95" 
                                onClick={handleAuthorize}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Transmitting...' : 'Authorize Transaction'}
                            </Button>
                            <button onClick={() => setStep(2)} className="w-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors py-2">Discard & Return to Step 2</button>
                        </div>
                    </div>
                )}
            </div>

            {/* History Table */}
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400 shadow-inner">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Settlement Ledger</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <select 
                            value={historyStatus} 
                            onChange={(e) => setHistoryStatus(e.target.value)} 
                            className="rounded-xl border-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest focus:ring-blue-500/20"
                        >
                            <option value="">All Statuses</option>
                            <option value={Status.Approved}>Approved</option>
                            <option value={Status.Pending}>Pending</option>
                            <option value={Status.Rejected}>Rejected</option>
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800">
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

                {/* Search Bar for Transfers */}
                <div className="mb-8 relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search by ID, Sender, or Recipient Name..."
                        className="w-full pl-12 pr-6 py-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner"
                    />
                </div>

                {paginatedHistory.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-50 dark:border-gray-800 shadow-inner">
                        <Table headers={['Date', 'Direction', 'Counterparty', 'Gross Amount', 'Status']}>
                            {paginatedHistory.map(t => {
                                const isSender = t.senderId === currentUser._id;
                                return (
                                    <tr key={t._id} className="text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-blue-900/5 transition-colors group">
                                        <td className="px-6 py-5 text-[11px] font-black uppercase text-gray-400 font-mono tracking-tighter">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${isSender ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {isSender ? 'Sent' : 'Received'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{isSender ? t.recipientName : t.senderName}</td>
                                        <td className={`px-6 py-5 font-black text-base ${isSender ? 'text-red-500' : 'text-green-600'}`}>
                                            {isSender ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                                        </td>
                                        <td className="px-6 py-5"><Badge status={t.status as Status} /></td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">No transfer entries found in ledger</p>
                    </div>
                )}

                {filteredTransfers.length > itemsPerPage && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t dark:border-gray-800">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page {currentPage}</span>
                        <div className="flex gap-2">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-black uppercase tracking-widest transition-all hover:bg-gray-200 disabled:opacity-30">Prev</button>
                            <button disabled={paginatedHistory.length < itemsPerPage} onClick={() => setCurrentPage(p => p + 1)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-black uppercase tracking-widest transition-all hover:bg-gray-200 disabled:opacity-30">Next</button>
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default TransferFunds;