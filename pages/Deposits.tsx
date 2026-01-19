
import React, { useState, useEffect, useCallback } from 'react';
import { Deposit, Status, formatCurrency, Currency } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { updateDeposit } from '../services/api';
import { getUploadsBaseUrl } from '../services/api';

// Helper to determine API URL based on environment
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    return (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:5000/api/v1'
        : 'https://smartearning-api.onrender.com/api/v1';
};

const Deposits: React.FC = () => {
    const { state, dispatch } = useData();
    const { deposits } = state;

    // Pagination State
    const [pagedDeposits, setPagedDeposits] = useState<Deposit[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [isFetchingPaged, setIsFetchingPaged] = useState(false);

    const tableHeaders = ['ID', 'User', 'Amount', 'Method', 'Transaction ID', 'Receipt', 'Status', 'Date'];
    
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
    
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [currentStatus, setCurrentStatus] = useState<Deposit['status']>(Status.Pending);
    const [isSaving, setIsSaving] = useState(false);
    
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    const UPLOADS_URL = getUploadsBaseUrl();

    // --- PAGINATED DATA FETCHING ---
    const fetchPagedDeposits = useCallback(async () => {
        setIsFetchingPaged(true);
        try {
            const url = `${getApiBaseUrl()}/deposits?page=${currentPage}&limit=${limit}`;
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                setPagedDeposits(result.data);
            }
        } catch (error) {
            console.error("Failed to fetch paginated deposits:", error);
        } finally {
            setIsFetchingPaged(false);
        }
    }, [currentPage, limit]);

    useEffect(() => {
        fetchPagedDeposits();
    }, [fetchPagedDeposits]);

    useEffect(() => {
        if (selectedDeposit) {
            setAdminNotes(selectedDeposit.adminNotes || '');
            setCurrentStatus(selectedDeposit.status);
        }
    }, [selectedDeposit]);

    // Filter Logic (Applied to the current page's results)
    const filteredDeposits = pagedDeposits.filter(deposit => {
        const matchesSearch = 
            deposit._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.amount.toString().includes(searchTerm);
        
        const matchesStatus = statusFilter ? deposit.status === statusFilter : true;
        const matchesCurrency = currencyFilter ? deposit.currency?.toUpperCase() === currencyFilter : true;

        return matchesSearch && matchesStatus && matchesCurrency;
    });

    const handleSaveChanges = async () => {
        if (selectedDeposit) {
            setIsSaving(true);
            try {
                const result = await updateDeposit(selectedDeposit._id, {
                    status: currentStatus,
                    adminNotes: adminNotes,
                });
                dispatch({ type: 'UPDATE_DEPOSIT', payload: result.deposit });
                dispatch({ type: 'UPDATE_USER', payload: result.user });
                
                // Update local list state
                setPagedDeposits(prev => prev.map(d => d._id === result.deposit._id ? result.deposit : d));
                
                handleCloseDetailModal();
            } catch (error) {
                console.error("Failed to update deposit:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not update deposit.'}`);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const getReceiptSrc = (url: string) => {
        if (url.startsWith('data:')) return url;
        return `${UPLOADS_URL}${url}`;
    }

    const handleViewReceipt = (e: React.MouseEvent, receiptUrl: string) => {
        e.stopPropagation(); 
        setSelectedReceipt(getReceiptSrc(receiptUrl));
        setIsImageModalOpen(true);
    };
    
    const handleRowClick = (deposit: Deposit) => {
        setSelectedDeposit(deposit);
        setIsDetailModalOpen(true);
    };

    const handleCloseImageModal = () => {
        setIsImageModalOpen(false);
        setSelectedReceipt(null);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedDeposit(null);
        setAdminNotes('');
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Deposit Requests</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                    >
                        <option value="">All Status</option>
                        <option value={Status.Pending}>Pending</option>
                        <option value={Status.Approved}>Approved</option>
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
                        placeholder="Search by ID, User, TxID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                    />
                </div>
            </div>
            
            <Table headers={tableHeaders}>
                {filteredDeposits.map((deposit: Deposit) => (
                    <tr 
                      key={deposit._id} 
                      className="text-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                      onClick={() => handleRowClick(deposit)}
                    >
                        <td className="px-4 py-3 text-xs font-mono">{deposit._id.substring(0, 8)}...</td>
                        <td className="px-4 py-3">{deposit.userName}</td>
                        <td className="px-4 py-3">{formatCurrency(deposit.amount, deposit.currency)}</td>
                        <td className="px-4 py-3">{deposit.method}</td>
                        <td className="px-4 py-3 text-xs font-mono">{deposit.transactionId}</td>
                        <td className="px-4 py-3">
                            {deposit.receiptUrl ? (
                                <button onClick={(e) => handleViewReceipt(e, deposit.receiptUrl!)} className="focus:outline-none rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                    <img src={getReceiptSrc(deposit.receiptUrl)} alt="Receipt thumbnail" className="h-10 w-16 object-cover rounded-md cursor-pointer hover:opacity-75 transition-opacity" />
                                </button>
                            ) : (
                                'N/A'
                            )}
                        </td>
                        <td className="px-4 py-3"><Badge status={deposit.status} /></td>
                        <td className="px-4 py-3 text-sm">{new Date(deposit.date).toLocaleDateString()}</td>
                    </tr>
                ))}
            </Table>

            {/* SERVER-SIDE PAGINATION CONTROLS */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t dark:border-gray-700 gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Records per page:</span>
                    <select 
                        value={limit} 
                        onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
                        className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 focus:ring-blue-500"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                <div className="flex items-center gap-4">
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1 || isFetchingPaged}
                    >
                        Previous
                    </Button>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        Page {currentPage}
                    </span>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={pagedDeposits.length < limit || isFetchingPaged}
                    >
                        Next
                    </Button>
                </div>
            </div>

            <Modal isOpen={isImageModalOpen} onClose={handleCloseImageModal}>
                {selectedReceipt && (
                    <div className="flex justify-center items-center p-2">
                        <img src={selectedReceipt} alt="Full-size receipt" className="rounded-md max-w-full max-h-[80vh] object-contain shadow-lg" />
                    </div>
                )}
            </Modal>

            {selectedDeposit && (
                 <Modal isOpen={isDetailModalOpen} onClose={handleCloseDetailModal}>
                    <div className="p-2 sm:p-4 text-gray-800 dark:text-gray-200">
                        <h3 className="text-xl font-bold mb-4">Deposit Details - <span className="text-blue-600 dark:text-blue-400">{selectedDeposit._id}</span></h3>
                        
                        {selectedDeposit.matchedWithdrawalId && (
                            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm">
                                This deposit was automatically matched to fulfill withdrawal request <strong>#{selectedDeposit.matchedWithdrawalId}</strong>. Approving this will pay that user.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                            <div><span className="font-semibold">User:</span> {selectedDeposit.userName} (ID: {selectedDeposit.userId})</div>
                            <div><span className="font-semibold">Amount:</span> {formatCurrency(selectedDeposit.amount, selectedDeposit.currency)}</div>
                            <div><span className="font-semibold">Method:</span> {selectedDeposit.method}</div>
                            <div><span className="font-semibold">Date:</span> {new Date(selectedDeposit.date).toLocaleString()}</div>
                            <div className="md:col-span-2"><span className="font-semibold">Transaction ID:</span> <span className="font-mono">{selectedDeposit.transactionId}</span></div>
                            <div className="md:col-span-2"><span className="font-semibold">Sender Account:</span> {selectedDeposit.senderAccountTitle || 'N/A'}</div>
                        </div>

                         {selectedDeposit.userNotes && (
                             <div className="mt-6">
                                <h4 className="font-semibold mb-2">User Notes:</h4>
                                <p className="text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">{selectedDeposit.userNotes}</p>
                            </div>
                         )}

                         <div className="mt-6">
                            <label htmlFor="status" className="block text-sm font-semibold mb-2">Status</label>
                            <select 
                                id="status" 
                                value={currentStatus} 
                                onChange={(e) => setCurrentStatus(e.target.value as Deposit['status'])}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value={Status.Pending}>Pending</option>
                                <option value={Status.Approved}>Approved</option>
                                <option value={Status.Rejected}>Rejected</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Changing status from <strong>Approved</strong> to Pending/Rejected will deduct the funds from the user.</p>
                        </div>

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

                        {selectedDeposit.receiptUrl && (
                            <div className="mt-6">
                                <h4 className="font-semibold mb-2">Receipt</h4>
                                <img src={getReceiptSrc(selectedDeposit.receiptUrl)} alt="Deposit receipt" className="rounded-lg w-full max-w-lg mx-auto shadow-md object-contain max-h-96" />
                            </div>
                        )}

                        <div className="mt-8 flex justify-end space-x-3 border-t dark:border-gray-700 pt-4">
                            <Button variant="secondary" onClick={handleCloseDetailModal}>Cancel</Button>
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

export default Deposits;
