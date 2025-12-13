
import React, { useState, useEffect } from 'react';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Status, Withdrawal, formatCurrency, Currency, Deposit } from '../types';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateWithdrawal, updateDeposit, getUploadsBaseUrl } from '../services/api';

const Withdrawals: React.FC = () => {
  const { state, dispatch } = useData();
  const { withdrawals, paymentMethods } = state;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState<Withdrawal['status']>(Status.Pending);
  
  // P2P Editing State
  const [p2pName, setP2pName] = useState('');
  const [p2pAccountTitle, setP2pAccountTitle] = useState('');
  const [p2pAccountNumber, setP2pAccountNumber] = useState('');
  const [p2pInstructions, setP2pInstructions] = useState('');
  const [p2pCustomFields, setP2pCustomFields] = useState<{ title: string; value: string }[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

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
          setP2pCustomFields(existingMethod.customFields || []);
      } else {
          setP2pName(`P2P - ${selectedWithdrawal.method}`);
          setP2pAccountTitle(selectedWithdrawal.accountTitle);
          setP2pAccountNumber(selectedWithdrawal.accountNumber);
          setP2pInstructions('');
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

  const filteredWithdrawals = withdrawals.filter(w => {
      const matchesSearch = 
        w._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.amount.toString().includes(searchTerm);
      
      const matchesStatus = statusFilter ? w.status === statusFilter : true;
      const matchesCurrency = currencyFilter ? w.currency?.toUpperCase() === currencyFilter : true;

      return matchesSearch && matchesStatus && matchesCurrency;
  });

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

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Withdrawal Requests</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              >
                  <option value="">All Status</option>
                  <option value={Status.Pending}>Pending</option>
                  <option value={Status.Matching}>Matching (P2P)</option>
                  <option value={Status.Approved}>Approved</option>
                  <option value={Status.Paid}>Paid</option>
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
      <Table headers={tableHeaders}>
          {filteredWithdrawals.map((withdrawal: Withdrawal) => (
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

      {selectedWithdrawal && (
           <Modal isOpen={true} onClose={handleCloseModal}>
              <div className="p-2 sm:p-4 text-gray-800 dark:text-gray-200">
                  <h3 className="text-xl font-bold mb-4">Withdrawal Details - <span className="text-blue-600 dark:text-blue-400">{selectedWithdrawal._id}</span></h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                      <div><span className="font-semibold">User:</span> {selectedWithdrawal.userName} (ID: {selectedWithdrawal.userId})</div>
                      <div><span className="font-semibold">Amount Requested:</span> {formatCurrency(selectedWithdrawal.amount, selectedWithdrawal.currency)}</div>
                      <div><span className="font-semibold">Fee:</span> {formatCurrency(selectedWithdrawal.fee, selectedWithdrawal.currency)}</div>
                      <div><span className="font-semibold">Final Amount:</span> {formatCurrency(selectedWithdrawal.finalAmount, selectedWithdrawal.currency)}</div>
                      <div><span className="font-semibold">Method:</span> {selectedWithdrawal.method}</div>
                      <div><span className="font-semibold">Date:</span> {new Date(selectedWithdrawal.date).toLocaleString()}</div>
                      <div className="md:col-span-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                          <div className="font-semibold mb-1">Account Details:</div>
                          <div>Title: {selectedWithdrawal.accountTitle}</div>
                          <div>Number: {selectedWithdrawal.accountNumber}</div>
                      </div>
                  </div>

                   {selectedWithdrawal.userNotes && (
                       <div className="mt-4">
                          <h4 className="font-semibold mb-2">User Notes:</h4>
                          <p className="text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">{selectedWithdrawal.userNotes}</p>
                      </div>
                   )}

                   {/* P2P MATCHING SECTION */}
                   {selectedWithdrawal.status === Status.Matching && (
                       <div className="mt-6 p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg">
                           <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">P2P Matching Status</h4>
                           <div className="flex justify-between items-center mb-4">
                               <span className="text-sm">Remaining to Match:</span>
                               <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                                   {formatCurrency(selectedWithdrawal.matchRemainingAmount !== undefined ? selectedWithdrawal.matchRemainingAmount : selectedWithdrawal.finalAmount, selectedWithdrawal.currency)}
                               </span>
                           </div>
                           
                           {selectedWithdrawal.matchedDepositIds && selectedWithdrawal.matchedDepositIds.length > 0 && (
                               <div className="space-y-2">
                                   <h5 className="font-semibold text-sm">Matched Deposits:</h5>
                                   <div className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                                       <table className="w-full text-xs text-left">
                                           <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                               <tr>
                                                   <th className="p-2">Depositor</th>
                                                   <th className="p-2">Amount</th>
                                                   <th className="p-2">Tx ID</th>
                                                   <th className="p-2">Status</th>
                                                   <th className="p-2">Proof</th>
                                                   <th className="p-2">Action</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y dark:divide-gray-700">
                                               {selectedWithdrawal.matchedDepositIds.map((deposit: Deposit) => (
                                                   <tr key={deposit._id}>
                                                       <td className="p-2">{deposit.userName}</td>
                                                       <td className="p-2 font-mono">{formatCurrency(deposit.amount, deposit.currency)}</td>
                                                       <td className="p-2 font-mono">{deposit.transactionId}</td>
                                                       <td className="p-2"><Badge status={matchedDepositStatus[deposit._id] || deposit.status} /></td>
                                                       <td className="p-2">
                                                           {deposit.receiptUrl ? <a href={getReceiptSrc(deposit.receiptUrl)} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">View</a> : 'N/A'}
                                                       </td>
                                                       <td className="p-2">
                                                           <div className="flex gap-1">
                                                               <button 
                                                                   onClick={() => handleUpdateMatchedDeposit(deposit._id, Status.Approved)} 
                                                                   className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                                                                   disabled={savingDepositId === deposit._id || (matchedDepositStatus[deposit._id] || deposit.status) === Status.Approved}
                                                                   title="Approve Payment"
                                                               >
                                                                   ✓
                                                               </button>
                                                               <button 
                                                                   onClick={() => handleUpdateMatchedDeposit(deposit._id, Status.Rejected)} 
                                                                   className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                                                   disabled={savingDepositId === deposit._id || (matchedDepositStatus[deposit._id] || deposit.status) === Status.Rejected}
                                                                   title="Reject Payment"
                                                               >
                                                                   ✗
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

                   <div className="mt-6 border-t dark:border-gray-700 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label htmlFor="status" className="block text-sm font-semibold mb-2">Request Status</label>
                              <select 
                                  id="status" 
                                  value={currentStatus} 
                                  onChange={(e) => setCurrentStatus(e.target.value as Withdrawal['status'])}
                                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              >
                                  <option value={Status.Pending}>Pending</option>
                                  <option value={Status.Matching}>Matching (P2P)</option>
                                  <option value={Status.Approved}>Approved (Processing)</option>
                                  <option value={Status.Paid}>Paid (Complete)</option>
                                  <option value={Status.Rejected}>Rejected</option>
                              </select>
                          </div>
                          <div>
                              <label htmlFor="adminNotes" className="block text-sm font-semibold mb-2">Admin Notes</label>
                              <textarea
                                  id="adminNotes"
                                  rows={1}
                                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="Internal remarks..."
                              />
                          </div>
                      </div>

                      {currentStatus === Status.Matching && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
                              <h5 className="font-semibold text-sm mb-2">P2P Payment Method Settings</h5>
                              <div className="grid grid-cols-1 gap-3">
                                  <input type="text" placeholder="Method Name (e.g. P2P - Easypaisa)" value={p2pName} onChange={e => setP2pName(e.target.value)} className="text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  <div className="grid grid-cols-2 gap-3">
                                      <input type="text" placeholder="Account Title" value={p2pAccountTitle} onChange={e => setP2pAccountTitle(e.target.value)} className="text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 w-full" />
                                      <input type="text" placeholder="Account Number" value={p2pAccountNumber} onChange={e => setP2pAccountNumber(e.target.value)} className="text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 w-full" />
                                  </div>
                                  <textarea placeholder="Instructions for depositors..." value={p2pInstructions} onChange={e => setP2pInstructions(e.target.value)} className="text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 w-full" rows={2} />
                                  
                                  {/* Custom Fields Section for P2P */}
                                  <div className="mt-2 border-t dark:border-gray-600 pt-2">
                                      <div className="flex justify-between items-center mb-2">
                                          <h6 className="text-xs font-semibold text-gray-500 uppercase">Custom Fields (e.g. Bank Code)</h6>
                                          <Button type="button" size="sm" variant="secondary" onClick={handleAddCustomField} className="py-0.5 px-2 text-xs">+ Add Field</Button>
                                      </div>
                                      
                                      {p2pCustomFields.map((field, index) => (
                                          <div key={index} className="flex gap-2 items-center mb-2">
                                              <input 
                                                  placeholder="Title (e.g. Branch Code)" 
                                                  value={field.title} 
                                                  onChange={(e) => handleCustomFieldChange(index, 'title', e.target.value)}
                                                  className="w-1/3 text-xs rounded-md dark:bg-gray-800 dark:border-gray-500"
                                              />
                                              <input 
                                                  placeholder="Value (e.g. 0911)" 
                                                  value={field.value} 
                                                  onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                                  className="w-full text-xs rounded-md dark:bg-gray-800 dark:border-gray-500"
                                              />
                                              <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-red-500 hover:text-red-700">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="mt-8 flex justify-end space-x-3">
                      <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                      <Button variant="primary" onClick={handleSaveChanges} disabled={isSaving}>
                          {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default Withdrawals;
