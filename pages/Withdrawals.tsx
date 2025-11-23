
import React, { useState, useEffect } from 'react';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Status, Withdrawal } from '../types';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import { updateWithdrawal, getUploadsBaseUrl } from '../services/api';

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
  const UPLOADS_URL = getUploadsBaseUrl();

  useEffect(() => {
    if (selectedWithdrawal) {
      setAdminNotes(selectedWithdrawal.adminNotes || '');
      setCurrentStatus(selectedWithdrawal.status);
      
      // Pre-fill P2P details
      // Check if there is already a P2P payment method associated with this withdrawal
      const existingMethod = paymentMethods.find(pm => pm.p2pWithdrawalId === selectedWithdrawal._id);

      if (existingMethod) {
          setP2pName(existingMethod.name);
          setP2pAccountTitle(existingMethod.accountTitle);
          setP2pAccountNumber(existingMethod.accountNumber);
          setP2pInstructions(existingMethod.instructions || '');
      } else {
          // Default pre-fill with user's withdrawal info
          setP2pName(`P2P - ${selectedWithdrawal.method}`);
          setP2pAccountTitle(selectedWithdrawal.accountTitle);
          setP2pAccountNumber(selectedWithdrawal.accountNumber);
          setP2pInstructions('');
      }
    }
  }, [selectedWithdrawal, paymentMethods]);

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
            const payload: any = {
                status: currentStatus,
                adminNotes: adminNotes,
            };

            // Include P2P details if status is Matching
            if (currentStatus === Status.Matching) {
                payload.p2pName = p2pName;
                payload.p2pAccountTitle = p2pAccountTitle;
                payload.p2pAccountNumber = p2pAccountNumber;
                payload.p2pInstructions = p2pInstructions;
            }

            const result = await updateWithdrawal(selectedWithdrawal._id, payload);
            // FIX: The API returns a complex object. Dispatch separate actions for withdrawal and user updates.
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

  // Helper to determine correct image source (Base64 vs File Path)
  const getReceiptSrc = (url: string) => {
        if (url.startsWith('data:')) return url;
        return `${UPLOADS_URL}${url}`;
  }


  const tableHeaders = ['User', 'Amount', 'Final Amount', 'Method', 'Status', 'Match Rem.', 'Date'];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Withdrawal Requests</h2>
      <Table headers={tableHeaders}>
        {withdrawals.map((w: Withdrawal) => (
          <tr 
            key={w._id} 
            className="text-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() => handleRowClick(w)}
          >
            <td className="px-4 py-3">{w.userName}</td>
            <td className="px-4 py-3">${w.amount.toFixed(2)}</td>
            <td className="px-4 py-3 font-semibold">${w.finalAmount.toFixed(2)}</td>
            <td className="px-4 py-3">{w.method}</td>
            <td className="px-4 py-3"><Badge status={w.status} /></td>
            <td className="px-4 py-3 text-sm">
                {w.status === Status.Matching || w.matchRemainingAmount !== undefined ? `$${(w.matchRemainingAmount !== undefined ? w.matchRemainingAmount : w.finalAmount).toFixed(2)}` : 'N/A'}
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
                  <div><span className="font-semibold">Amount:</span> ${selectedWithdrawal.amount.toFixed(2)}</div>
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

              {/* Matched Deposits Section */}
              {selectedWithdrawal.matchedDepositIds && selectedWithdrawal.matchedDepositIds.length > 0 && (
                  <div className="mt-6 pt-4 border-t dark:border-gray-700">
                      <h4 className="font-semibold mb-3 text-blue-600 dark:text-blue-400">Matched Payments Log (P2P)</h4>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase">
                                  <tr>
                                      <th className="px-3 py-2">Depositor</th>
                                      <th className="px-3 py-2">Amount</th>
                                      <th className="px-3 py-2">Date</th>
                                      <th className="px-3 py-2">Receipt</th>
                                      <th className="px-3 py-2">Status</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {selectedWithdrawal.matchedDepositIds.map((deposit: any) => (
                                      <tr key={deposit._id} className="border-b dark:border-gray-700">
                                          <td className="px-3 py-2">{deposit.userName}</td>
                                          <td className="px-3 py-2 font-bold text-green-600">${deposit.amount.toFixed(2)}</td>
                                          <td className="px-3 py-2">{new Date(deposit.date).toLocaleDateString()}</td>
                                          <td className="px-3 py-2">
                                              {deposit.receiptUrl ? (
                                                  <a href={getReceiptSrc(deposit.receiptUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View</a>
                                              ) : 'N/A'}
                                          </td>
                                          <td className="px-3 py-2"><Badge status={deposit.status} /></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                      <div className="mt-2 text-right text-sm font-semibold">
                          Total Matched: <span className="text-green-600">${selectedWithdrawal.matchedDepositIds.reduce((sum: number, d: any) => sum + d.amount, 0).toFixed(2)}</span>
                          <span className="mx-2">/</span>
                          Pending: <span className="text-red-600">${(selectedWithdrawal.matchRemainingAmount ?? selectedWithdrawal.finalAmount).toFixed(2)}</span>
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
                      <option value={Status.Pending}>Pending</option>
                      <option value={Status.Matching}>Matching (P2P)</option>
                      <option value={Status.Approved}>Approved</option>
                      <option value={Status.Paid}>Paid</option>
                      <option value={Status.Rejected}>Rejected</option>
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
