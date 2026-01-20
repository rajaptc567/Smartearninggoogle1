import React, { useState, useEffect, useMemo } from 'react';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Status, Withdrawal, formatCurrency, Currency, Deposit, HomepagePaymentLogo } from '../types';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateWithdrawal, updateDeposit, getUploadsBaseUrl } from '../services/api';

const Withdrawals: React.FC = () => {
  const { state, dispatch } = useData();
  const { withdrawals, paymentMethods, settings } = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState<Withdrawal['status']>(Status.Pending);
  
  // P2P Editing State
  const [p2pName, setP2pName] = useState('');
  const [p2pAccountTitle, setP2pAccountTitle] = useState('');
  const [p2pAccountNumber, setP2pAccountNumber] = useState('');
  const [p2pInstructions, setP2pInstructions] = useState('');
  const [p2pLogoUrl, setP2pLogoUrl] = useState('');
  const [p2pCustomFields, setP2pCustomFields] = useState<{ title: string; value: string }[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Matched Deposit status editing state
  const [matchedDepositStatus, setMatchedDepositStatus] = useState<Record<string, Deposit['status']>>({});
  const [savingDepositId, setSavingDepositId] = useState<string | null>(null);

  const UPLOADS_URL = getUploadsBaseUrl();

  useEffect(() => {
    if (selectedWithdrawal) {
      setAdminNotes(selectedWithdrawal.adminNotes || '');
      setCurrentStatus(selectedWithdrawal.status);
      
      const existingMethod = paymentMethods.find(pm => pm.p2pWithdrawalId === selectedWithdrawal._id);
      if (existingMethod) {
          setP2pName(existingMethod.name);
          setP2pAccountTitle(existingMethod.accountTitle);
          setP2pAccountNumber(existingMethod.accountNumber);
          setP2pInstructions(existingMethod.instructions || '');
          setP2pLogoUrl(existingMethod.logoUrl || '');
          setP2pCustomFields(existingMethod.customFields || []);
      } else {
          setP2pName(`P2P - ${selectedWithdrawal.method}`);
          setP2pAccountTitle(selectedWithdrawal.accountTitle);
          setP2pAccountNumber(selectedWithdrawal.accountNumber);
          setP2pInstructions('');
          setP2pLogoUrl('');
          setP2pCustomFields([]);
      }

      // Initialize statuses for matched deposits
      const initialStatuses: Record<string, Deposit['status']> = {};
      (selectedWithdrawal.matchedDepositIds || []).forEach(dep => {
          initialStatuses[dep._id] = dep.status;
      });
      setMatchedDepositStatus(initialStatuses);
    }
  }, [selectedWithdrawal, paymentMethods]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(w => {
        const matchesSearch = 
          w._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          w.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          w.amount.toString().includes(searchTerm);
        
        const matchesStatus = statusFilter ? w.status === statusFilter : true;
        const matchesCurrency = currencyFilter ? w.currency?.toUpperCase() === currencyFilter : true;

        return matchesSearch && matchesStatus && matchesCurrency;
    });
  }, [withdrawals, searchTerm, statusFilter, currencyFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, currencyFilter, itemsPerPage]);

  // Pagination Calculation
  const totalItems = filteredWithdrawals.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedWithdrawals = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredWithdrawals.slice(start, start + itemsPerPage);
  }, [filteredWithdrawals, currentPage, itemsPerPage]);

  const handleRowClick = (w: Withdrawal) => {
    setSelectedWithdrawal(w);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedWithdrawal(null);
  };

  const handleAddCustomField = () => {
      setP2pCustomFields([...p2pCustomFields, { title: '', value: '' }]);
  };

  const handleCustomFieldChange = (index: number, field: 'title' | 'value', value: string) => {
      const updated = [...p2pCustomFields];
      updated[index][field] = value;
      setP2pCustomFields(updated);
  };

  const handleRemoveCustomField = (index: number) => {
      setP2pCustomFields(p2pCustomFields.filter((_, i) => i !== index));
  };

  const handleSelectSavedLogo = (logo: HomepagePaymentLogo) => {
      setP2pName(logo.name);
      setP2pLogoUrl(logo.logoUrl);
  };

  const handleSaveChanges = async () => {
    if (selectedWithdrawal) {
        setIsSaving(true);
        try {
            const payload: any = { status: currentStatus, adminNotes: adminNotes };
            if (currentStatus === Status.Matching) {
                payload.p2pName = p2pName;
                payload.p2pAccountTitle = p2pAccountTitle;
                payload.p2pAccountNumber = p2pAccountNumber;
                payload.p2pInstructions = p2pInstructions;
                payload.p2pLogoUrl = p2pLogoUrl;
                payload.p2pCustomFields = p2pCustomFields.filter(f => f.title.trim() !== ''); // Clean empty fields
            }
            const result = await updateWithdrawal(selectedWithdrawal._id, payload);
            dispatch({ type: 'UPDATE_WITHDRAWAL', payload: result.withdrawal });
            dispatch({ type: 'UPDATE_USER', payload: result.user });
            handleCloseModal();
        } catch (error) {
            console.error("Failed to update withdrawal:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Could not update withdrawal.'}`);
        } finally {
            setIsSaving(false);
        }
    }
  };

  const handleUpdateMatchedDeposit = async (depositId: string, newStatus: Deposit['status']) => {
    if (!selectedWithdrawal) return;
    setSavingDepositId(depositId);
    
    // Generate a more user-friendly reason for the admin notes, which may be shown to the user.
    let notesForUpdate = `Status updated to ${newStatus} by admin via P2P review.`;
    if (newStatus === Status.Rejected) {
        notesForUpdate = 'Payment could not be verified. Please contact support if this is an error.';
    } else if (newStatus === Status.Approved) {
        notesForUpdate = 'Payment verified and approved.';
    }

    try {
        const result = await updateDeposit(depositId, { 
            status: newStatus, 
            adminNotes: notesForUpdate
        });

        dispatch({ type: 'UPDATE_DEPOSIT', payload: result.deposit });
        if(result.user) dispatch({ type: 'UPDATE_USER', payload: result.user });

        setSelectedWithdrawal(prev => {
            if (!prev) return null;
            const updatedMatchedDeposits = (prev.matchedDepositIds || []).map(d => 
                d._id === depositId ? { ...d, status: newStatus } : d
            );
            
            let newRemainingAmount = prev.matchRemainingAmount ?? prev.finalAmount;
            const originalDeposit = prev.matchedDepositIds?.find(d => d._id === depositId);

            if (originalDeposit) {
                const originalStatus = originalDeposit.status;
                const depositAmount = originalDeposit.amount;

                const wasProcessed = originalStatus === 'Approved' || originalStatus === 'Pending';
                const isNowRejected = newStatus === 'Rejected';
                const wasRejected = originalStatus === 'Rejected';
                const isNowProcessed = newStatus === 'Approved' || newStatus === 'Pending';

                // If a processed (approved/pending) deposit is rejected, refund the withdrawal
                if (wasProcessed && isNowRejected) {
                    newRemainingAmount += depositAmount;
                } 
                // If a rejected deposit is re-activated (approved/pending), reclaim the funds for the withdrawal
                else if (wasRejected && isNowProcessed) {
                    newRemainingAmount -= depositAmount;
                }
            }

            return { 
                ...prev, 
                matchedDepositIds: updatedMatchedDeposits, 
                matchRemainingAmount: Math.max(0, Math.min(prev.finalAmount, newRemainingAmount))
            };
        });

        setMatchedDepositStatus(prev => ({ ...prev, [depositId]: newStatus }));
        
    } catch (error) {
        console.error("Failed to update matched deposit:", error);
        alert(`Error: ${error instanceof Error ? error.message : 'Could not update status.'}`);
    } finally {
        setSavingDepositId(null);
    }
  };

  const getReceiptSrc = (url: string) => {
        if (url.startsWith('data:')) return url;
        return `${UPLOADS_URL}${url}`;
  }

  const tableHeaders = ['ID', 'User', 'Amount', 'Final Amount', 'Method', 'Status', 'Match Rem.', 'Date'];

  const savedLogos = settings.homepagePaymentLogos || [];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Withdrawal Requests</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
              <div className="flex items-center gap-2 mr-2">
                  <label className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap">Show:</label>
                  <select 
                      value={itemsPerPage} 
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm py-1 shadow-sm focus:ring-blue-500"
                  >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                  </select>
              </div>
              <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              >
                  <option value="">All Status</option>
                  <option value={Status.Pending}>Pending</option>
                  <option value={Status.Matching}>Matching (P2P)</option>
                  <option value={Status.Approved}>Approved (Processing)</option>
                  <option value={Status.Paid}>Paid (Complete)</option>
                  <option value={Status.Rejected}>Rejected</option>
              </select>
               <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value as Currency | '')}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              >
                  <option value="">All Currencies</option>
                  <option value="PKR">PKR</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
              </select>
              <input 
                  type="text" 
                  placeholder="Search by ID, User, Amount..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              />
          </div>
      </div>
      
      <div className="space-y-4">
        <Table headers={tableHeaders}>
            {paginatedWithdrawals.map((withdrawal: Withdrawal) => (
                <tr 
                  key={withdrawal._id} 
                  className="text-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  onClick={() => handleRowClick(withdrawal)}
                >
                    <td className="px-4 py-3 text-xs font-mono">{withdrawal._id.substring(0, 8)}...</td>
                    <td className="px-4 py-3">{withdrawal.userName}</td>
                    <td className="px-4 py-3">{formatCurrency(withdrawal.amount, withdrawal.currency)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(withdrawal.finalAmount, withdrawal.currency)}</td>
                    <td className="px-4 py-3">{withdrawal.method}</td>
                    <td className="px-4 py-3"><Badge status={withdrawal.status} /></td>
                    <td className="px-4 py-3 text-sm">
                        {withdrawal.status === Status.Matching ? (
                            withdrawal.matchRemainingAmount !== undefined 
                                ? formatCurrency(withdrawal.matchRemainingAmount, withdrawal.currency) 
                                : formatCurrency(withdrawal.finalAmount, withdrawal.currency)
                        ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(withdrawal.date).toLocaleDateString()}</td>
                </tr>
            ))}
        </Table>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> withdrawals
            </div>
            <div className="flex gap-2">
                <Button 
                    variant="secondary" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="rounded-xl px-4"
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
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                    currentPage === pageNum 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                    className="rounded-xl px-4"
                >
                    Next &rarr;
                </Button>
            </div>
        </div>
      </div>

      {selectedWithdrawal && (
           <Modal isOpen={true} onClose={handleCloseModal}>
              <div className="p-2 sm:p-4 text-gray-800 dark:text-gray-200 w-[90vw] max-w-4xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                  <h3 className="text-xl font-bold mb-4">Withdrawal Details - <span className="text-blue-600 dark:text-blue-400">{selectedWithdrawal._id}</span></h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">User</span> {selectedWithdrawal.userName} (ID: {selectedWithdrawal.userId})</div>
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">Amount Requested</span> {formatCurrency(selectedWithdrawal.amount, selectedWithdrawal.currency)}</div>
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">Processing Fee</span> {formatCurrency(selectedWithdrawal.fee, selectedWithdrawal.currency)}</div>
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">Net Amount to Pay</span> <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(selectedWithdrawal.finalAmount, selectedWithdrawal.currency)}</span></div>
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">Original Method</span> {selectedWithdrawal.method}</div>
                      <div><span className="font-semibold text-gray-500 uppercase text-xs block">Requested Date</span> {new Date(selectedWithdrawal.date).toLocaleString()}</div>
                      <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-[1.5rem] border dark:border-gray-700">
                          <div className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-2">Member Account Destination:</div>
                          <div className="font-bold text-gray-900 dark:text-white">Title: {selectedWithdrawal.accountTitle}</div>
                          <div className="font-mono text-gray-600 dark:text-gray-300">Number/IBAN: {selectedWithdrawal.accountNumber}</div>
                      </div>
                  </div>

                   {selectedWithdrawal.userNotes && (
                       <div className="mt-4">
                          <h4 className="font-semibold text-gray-500 uppercase text-xs mb-2">User Remarks:</h4>
                          <p className="text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-600 italic">"{selectedWithdrawal.userNotes}"</p>
                      </div>
                   )}

                   {/* P2P MATCHING SECTION */}
                   {selectedWithdrawal.status === Status.Matching && (
                       <div className="mt-6 p-5 border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-900/50 rounded-[2.5rem] shadow-sm">
                           <h4 className="font-black text-orange-700 dark:text-orange-300 mb-3 uppercase tracking-tighter flex items-center gap-2">
                               <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">P2P</div>
                               Active Matching Status
                            </h4>
                           <div className="flex justify-between items-center mb-6 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border dark:border-orange-900/30">
                               <span className="text-xs font-bold text-orange-600">Balance Pending Match:</span>
                               <span className="font-black text-2xl text-orange-600 dark:text-orange-400">
                                   {formatCurrency(selectedWithdrawal.matchRemainingAmount !== undefined ? selectedWithdrawal.matchRemainingAmount : selectedWithdrawal.finalAmount, selectedWithdrawal.currency)}
                               </span>
                           </div>
                           
                           {selectedWithdrawal.matchedDepositIds && selectedWithdrawal.matchedDepositIds.length > 0 && (
                               <div className="space-y-3">
                                   <h5 className="font-black text-[10px] text-orange-400 uppercase tracking-widest">Matched Payment Streams</h5>
                                   <div className="max-h-60 overflow-y-auto border dark:border-orange-900/30 rounded-[1.5rem] bg-white dark:bg-gray-900 shadow-inner">
                                       <table className="w-full text-xs text-left">
                                           <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 sticky top-0 uppercase text-[9px] font-black">
                                               <tr>
                                                   <th className="p-3">Depositor</th>
                                                   <th className="p-3">Amount</th>
                                                   <th className="p-3">Status</th>
                                                   <th className="p-3">Proof</th>
                                                   <th className="p-3 text-right">Action</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y dark:divide-gray-800">
                                               {selectedWithdrawal.matchedDepositIds.map((deposit: Deposit) => (
                                                   <tr key={deposit._id} className="hover:bg-gray-50 dark:hover:bg-black/20">
                                                       <td className="p-3 font-bold">{deposit.userName}</td>
                                                       <td className="p-3 font-mono font-black">{formatCurrency(deposit.amount, deposit.currency)}</td>
                                                       <td className="p-3"><Badge status={matchedDepositStatus[deposit._id] || deposit.status} /></td>
                                                       <td className="p-3">
                                                           {deposit.receiptUrl ? <a href={getReceiptSrc(deposit.receiptUrl)} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-bold">View Screenshot</a> : <span className="text-gray-400">No Proof</span>}
                                                       </td>
                                                       <td className="p-3 text-right">
                                                           <div className="flex gap-2 justify-end">
                                                               <button 
                                                                   onClick={() => handleUpdateMatchedDeposit(deposit._id, Status.Approved)} 
                                                                   className="px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-30 transition-all font-bold"
                                                                   disabled={savingDepositId === deposit._id || (matchedDepositStatus[deposit._id] || deposit.status) === Status.Approved}
                                                               >
                                                                   Verify
                                                               </button>
                                                               <button 
                                                                   onClick={() => handleUpdateMatchedDeposit(deposit._id, Status.Rejected)} 
                                                                   className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-30 transition-all font-bold"
                                                                   disabled={savingDepositId === deposit._id || (matchedDepositStatus[deposit._id] || deposit.status) === Status.Rejected}
                                                               >
                                                                   Reject
                                                               </button>
                                                           </div>
                                                       </td>
                                                   </tr>
                                               ))}
                                           </tbody>
                                       </table>
                                   </div>
                               </div>
                           )}
                       </div>
                   )}

                   <div className="mt-8 border-t dark:border-gray-700 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label htmlFor="status" className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 tracking-widest">Update Request Status</label>
                              <select 
                                  id="status" 
                                  value={currentStatus} 
                                  onChange={(e) => setCurrentStatus(e.target.value as Withdrawal['status'])}
                                  className="w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white font-bold"
                              >
                                  <option value={Status.Pending}>Pending Admin Review</option>
                                  <option value={Status.Matching}>Assign to P2P Matching</option>
                                  <option value={Status.Approved}>Approved for Gateway</option>
                                  <option value={Status.Paid}>Mark as Paid / Complete</option>
                                  <option value={Status.Rejected}>Reject Request</option>
                              </select>
                          </div>
                          <div>
                              <label htmlFor="adminNotes" className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 tracking-widest">Internal Admin Notes</label>
                              <textarea
                                  id="adminNotes"
                                  rows={1}
                                  className="w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="Type notes for other admins..."
                              />
                          </div>
                      </div>

                      {currentStatus === Status.Matching && (
                          <div className="mt-6 space-y-6 animate-fade-in">
                              
                              {/* BRANDING LIBRARY INTEGRATION */}
                              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-blue-900/20 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/50 shadow-inner">
                                <label className="block text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-[0.2em] mb-4">P2P Gateway Brand Identity</label>
                                <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar">
                                    {savedLogos.map((logo, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleSelectSavedLogo(logo)}
                                            className={`shrink-0 p-4 rounded-3xl border bg-white dark:bg-gray-800 transition-all hover:scale-105 flex flex-col items-center gap-2 w-28 ${p2pName === logo.name ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-xl' : 'border-gray-200 dark:border-gray-700'}`}
                                        >
                                            <img src={logo.logoUrl} alt={logo.name} className="h-12 w-12 object-contain" />
                                            <span className="text-[10px] font-black uppercase truncate w-full text-center tracking-tighter">{logo.name}</span>
                                        </button>
                                    ))}
                                    {savedLogos.length === 0 && (
                                        <div className="w-full text-center py-4 text-xs text-gray-400 italic">Configure branding in Settings &rarr; Homepage Logos first.</div>
                                    )}
                                </div>
                              </div>

                              <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border dark:border-gray-700">
                                  <h5 className="font-black text-xs text-gray-500 uppercase mb-4 tracking-widest">Active P2P Gateway Overrides</h5>
                                  <div className="grid grid-cols-1 gap-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Display Title</label>
                                              <input type="text" placeholder="e.g. P2P - Easypaisa" value={p2pName} onChange={e => setP2pName(e.target.value)} className="font-bold rounded-xl dark:bg-gray-800 dark:border-gray-600 w-full" />
                                          </div>
                                          <div>
                                              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Branded Logo URL (or selected above)</label>
                                              <input type="text" readOnly placeholder="Select from library above" value={p2pLogoUrl} className="text-xs font-mono rounded-xl bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 w-full" />
                                          </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Recipient Account Title</label>
                                              <input type="text" placeholder="Account Title" value={p2pAccountTitle} onChange={e => setP2pAccountTitle(e.target.value)} className="font-bold rounded-xl dark:bg-gray-800 dark:border-gray-600 w-full" />
                                          </div>
                                          <div>
                                              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Recipient Account Number</label>
                                              <input type="text" placeholder="Account Number" value={p2pAccountNumber} onChange={e => setP2pAccountNumber(e.target.value)} className="font-mono font-bold rounded-xl dark:bg-gray-800 dark:border-gray-600 w-full" />
                                          </div>
                                      </div>

                                      <div>
                                          <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Payment Instructions for Depositors</label>
                                          <textarea placeholder="e.g. Please transfer funds and upload the proof. This is a direct member payment." value={p2pInstructions} onChange={e => setP2pInstructions(e.target.value)} className="rounded-2xl dark:bg-gray-800 dark:border-gray-600 w-full text-xs" rows={2} />
                                      </div>
                                      
                                      {/* Custom Fields Section for P2P */}
                                      <div className="mt-2 border-t dark:border-gray-600 pt-4">
                                          <div className="flex justify-between items-center mb-3">
                                              <h6 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Extended Gateway Fields</h6>
                                              <button type="button" onClick={handleAddCustomField} className="text-blue-500 text-[10px] font-black hover:underline uppercase">+ New Metadata Field</button>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            {p2pCustomFields.map((field, index) => (
                                                <div key={index} className="flex gap-3 items-center p-3 bg-white dark:bg-black/20 rounded-2xl border dark:border-gray-700">
                                                    <input 
                                                        placeholder="Label (e.g. Bank Code)" 
                                                        value={field.title} 
                                                        onChange={(e) => handleCustomFieldChange(index, 'title', e.target.value)}
                                                        className="w-1/3 text-xs font-bold rounded-xl dark:bg-gray-800 dark:border-gray-500"
                                                    />
                                                    <input 
                                                        placeholder="Value (e.g. 0911)" 
                                                        value={field.value} 
                                                        onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                                        className="w-full text-xs rounded-xl dark:bg-gray-800 dark:border-gray-500"
                                                    />
                                                    <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-red-500 hover:text-red-700 p-2 font-black text-lg">×</button>
                                                </div>
                                            ))}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="mt-10 flex justify-end space-x-3 pt-6 border-t dark:border-gray-700">
                      <Button variant="secondary" onClick={handleCloseModal}>Cancel / Discard</Button>
                      <Button variant="primary" onClick={handleSaveChanges} disabled={isSaving} className="px-10 py-3 shadow-xl shadow-blue-500/30 uppercase tracking-[0.2em] font-black">
                          {isSaving ? 'Processing...' : 'Commit Status Update'}
                      </Button>
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default Withdrawals;