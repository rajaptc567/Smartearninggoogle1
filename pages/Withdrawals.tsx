
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
      } else {
          setP2pName(`P2P - ${selectedWithdrawal.method}`);
          setP2pAccountTitle(selectedWithdrawal.accountTitle);
          setP2pAccountNumber(selectedWithdrawal.accountNumber);
          setP2pInstructions('');
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
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
              </select>
              <input 
                  type="text" 
                  placeholder="Search by ID, User..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              />
          </div>
      </div>
      <Table headers={tableHeaders}>
        {filteredWithdrawals.map((w: Withdrawal) => (
          <tr 
            key={w._id} 
            className="text-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() => handleRowClick(w)}
          >
            <td className="px-4 py-3 text-xs font-mono">{w._id.substring(0, 8)}...</td>
            <td className="px-4 py-3">{w.userName}</td>
            <td className="px-4 py-3">{formatCurrency(w.amount, w.currency)}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(w.finalAmount, w.currency)}</td>
            <td className="px-4 py-3">{w.method}</td>
            <td className="px-4 py-3"><Badge status={w.status} /></td>
            <td className="px-4 py-3 text-sm">
                {w.status === Status.Matching || w.matchRemainingAmount !== undefined ? formatCurrency((w.matchRemainingAmount !== undefined ? w.matchRemainingAmount : w.finalAmount), w.currency) : 'N/A'}
            </td>
            <td className="px-4 py-3 text-sm">{new Date(w.date).toLocaleDateString()}</td>
          </tr>
        ))}
      </Table>
      
      {selectedWithdrawal && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
           <div className="p-2 sm:p-4 text-gray-800 dark:text-gray-200">
              <h3 className="text-xl font-bold mb-4">Withdrawal Details - <span className="text-blue-600 dark:text-blue-400">{selectedWithdrawal._id}</span></h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div><span className="font-semibold">User:</span> {selectedWithdrawal.userName} (ID: {selectedWithdrawal.userId})</div>
                  <div><span className="font-semibold">Amount:</span> {formatCurrency(selectedWithdrawal.amount, selectedWithdrawal.currency)}</div>
                  <div><span className="font-semibold">Method:</span> {selectedWithdrawal.method}</div>
                  <div><span className="font-semibold">Date:</span> {new Date(selectedWithdrawal.date).toLocaleString()}</div>
              </div>

              <div className="mt-4 border-t pt-4 dark:border-gray-700">
                <h4 className="font-semibold mb-2">User Payment Details:</h4>
                <div className="text-sm space-y-1">
                    <p><span className="font-semibold">Account Title:</span> {selectedWithdrawal.accountTitle}</p>
                    <p><span className="font-semibold">Account Number:</span> {selectedWithdrawal.accountNumber}</p>
                </div>
              </div>
              
              {selectedWithdrawal.userNotes && (
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <h4 className="font-semibold mb-2">User Notes:</h4>
                    <p className="text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">{selectedWithdrawal.userNotes}</p>
                </div>
              )}

              {selectedWithdrawal.matchedDepositIds && selectedWithdrawal.matchedDepositIds.length > 0 && (
                  <div className="mt-6 pt-4 border-t dark:border-gray-700">
                      <h4 className="font-semibold mb-3 text-blue-600 dark:text-blue-400">Matched Payments Log (P2P)</h4>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                          {selectedWithdrawal.matchedDepositIds.map((deposit: Deposit) => (
                              <div key={deposit._id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border dark:border-gray-600">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <p className="font-bold text-gray-800 dark:text-gray-100">{deposit.userName}</p>
                                          <p className="text-xl font-bold text-green-600">{formatCurrency(deposit.amount, selectedWithdrawal.currency)}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <select
                                              value={matchedDepositStatus[deposit._id] || deposit.status}
                                              onChange={(e) => setMatchedDepositStatus(prev => ({ ...prev, [deposit._id]: e.target.value as Deposit['status'] }))}
                                              className="text-xs rounded-md dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                              disabled={savingDepositId === deposit._id}
                                          >
                                              <option value={Status.Pending}>Pending</option>
                                              <option value={Status.Approved}>Approved</option>
                                              <option value={Status.Rejected}>Rejected</option>
                                          </select>
                                          <Button
                                              size="sm"
                                              onClick={() => handleUpdateMatchedDeposit(deposit._id, matchedDepositStatus[deposit._id])}
                                              disabled={savingDepositId === deposit._id || matchedDepositStatus[deposit._id] === deposit.status}
                                          >
                                              {savingDepositId === deposit._id ? '...' : 'Save'}
                                          </Button>
                                      </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t dark:border-gray-600 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                                      <div><strong>Date:</strong> {new Date(deposit.date).toLocaleString()}</div>
                                      <div><strong>Method:</strong> {deposit.method}</div>
                                      <div><strong>Sender:</strong> {deposit.senderAccountTitle || 'N/A'}</div>
                                      <div><strong>Tx ID:</strong> <span className="font-mono">{deposit.transactionId}</span></div>
                                  </div>
                                  
                                  {deposit.userNotes && (
                                      <div className="mt-2 pt-2 border-t dark:border-gray-600 text-xs">
                                          <p className="font-semibold text-gray-500">Depositor Notes:</p>
                                          <p className="italic text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{deposit.userNotes}</p>
                                      </div>
                                  )}

                                  {deposit.receiptUrl && (
                                      <div className="mt-2 text-center">
                                          <a href={getReceiptSrc(deposit.receiptUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm font-medium">
                                              View Receipt
                                          </a>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                      <div className="mt-2 text-right text-sm font-semibold">
                          Total Matched: <span className="text-green-600">{formatCurrency(selectedWithdrawal.matchedDepositIds.filter(d=>d.status === 'Approved').reduce((sum, d) => sum + d.amount, 0), selectedWithdrawal.currency)}</span>
                          <span className="mx-2">/</span>
                          Pending: <span className="text-red-600">{formatCurrency((selectedWithdrawal.matchRemainingAmount ?? selectedWithdrawal.finalAmount), selectedWithdrawal.currency)}</span>
                      </div>
                  </div>
              )}

              <div className="mt-6">
                  <label htmlFor="status" className="block text-sm font-semibold mb-2">Status</label>
                  <select 
                      id="status" 
                      value={currentStatus} 
                      onChange={(e) => setCurrentStatus(e.target.value as Withdrawal['status'])}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                      <option value={Status.Pending}>Pending</option><option value={Status.Matching}>Matching (P2P)</option>
                      <option value={Status.Approved}>Approved</option><option value={Status.Paid}>Paid</option><option value={Status.Rejected}>Rejected</option>
                  </select>
              </div>

              {currentStatus === Status.Matching && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-sm">P2P Public Display Details</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                          This will automatically enable a Deposit Method for other users to match this withdrawal.
                          Edit these details if you want to hide sensitive info or provide specific instructions.
                      </p>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Display Method Name</label>
                              <input type="text" value={p2pName} onChange={(e) => setP2pName(e.target.value)} className="w-full mt-1 text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Public Account Title</label>
                              <input type="text" value={p2pAccountTitle} onChange={(e) => setP2pAccountTitle(e.target.value)} className="w-full mt-1 text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Public Account Number</label>
                              <input type="text" value={p2pAccountNumber} onChange={(e) => setP2pAccountNumber(e.target.value)} className="w-full mt-1 text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Public Instructions</label>
                              <textarea value={p2pInstructions} onChange={(e) => setP2pInstructions(e.target.value)} rows={2} placeholder="e.g., Please send screenshot after payment" className="w-full mt-1 text-sm rounded-md dark:bg-gray-700 dark:border-gray-600" />
                          </div>
                      </div>
                  </div>
              )}

              <div className="mt-6">
                  <label htmlFor="adminNotes" className="block text-sm font-semibold mb-2">Admin Notes</label>
                  <textarea
                      id="adminNotes"
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add remarks for this transaction..."
                  />
              </div>

              <div className="mt-8 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
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
