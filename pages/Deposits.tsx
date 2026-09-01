import React, { useState, useEffect, useMemo } from 'react';
import { Deposit, Status, formatCurrency, Currency } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { updateDeposit } from '../services/api';
import { getUploadsBaseUrl } from '../services/api';

const Deposits: React.FC = () => {
    const { state, dispatch } = useData();
    const { deposits } = state;

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

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const UPLOADS_URL = getUploadsBaseUrl();

    useEffect(() => {
        if (selectedDeposit) {
            setAdminNotes(selectedDeposit.adminNotes || '');
            setCurrentStatus(selectedDeposit.status);
        }
    }, [selectedDeposit]);

    // Filter Logic
    const filteredDeposits = useMemo(() => {
        return deposits.filter(deposit => {
            const matchesSearch = 
                deposit._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                deposit.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                deposit.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                deposit.amount.toString().includes(searchTerm);
            
            const matchesStatus = statusFilter ? deposit.status === statusFilter : true;
            const matchesCurrency = currencyFilter ? deposit.currency?.toUpperCase() === currencyFilter : true;

            return matchesSearch && matchesStatus && matchesCurrency;
        });
    }, [deposits, searchTerm, statusFilter, currencyFilter]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, currencyFilter, itemsPerPage]);

    // Pagination Calculation
    const totalItems = filteredDeposits.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedDeposits = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredDeposits.slice(start, start + itemsPerPage);
    }, [filteredDeposits, currentPage, itemsPerPage]);

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

            {/* Quick Status Tabs with Badge Counters */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 custom-scrollbar">
                {(() => {
                    const pendingCount = deposits.filter(d => d.status === Status.Pending).length;
                    const approvedCount = deposits.filter(d => d.status === Status.Approved).length;
                    const rejectedCount = deposits.filter(d => d.status === Status.Rejected).length;
                    return (
                        <>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === '' 
                                        ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 shadow-sm' 
                                        : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <span>All Deposits</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-600/20">{deposits.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter(Status.Pending)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === Status.Pending 
                                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20' 
                                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100'
                                }`}
                            >
                                <span>⏳ Pending Action</span>
                                {pendingCount > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-amber-500 text-slate-900">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter(Status.Approved)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === Status.Approved 
                                        ? 'bg-emerald-600 text-white shadow-sm' 
                                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
                                }`}
                            >
                                <span>✅ Approved</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20">{approvedCount}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter(Status.Rejected)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === Status.Rejected 
                                        ? 'bg-rose-600 text-white shadow-sm' 
                                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100'
                                }`}
                            >
                                <span>❌ Rejected</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/20">{rejectedCount}</span>
                            </button>
                        </>
                    );
                })()}
            </div>

            <div className="space-y-4">
                <Table headers={tableHeaders}>
                    {paginatedDeposits.map((deposit: Deposit) => (
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

                {/* Pagination Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> deposits
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

                        {selectedDeposit.confirmationAnswers && Object.keys(selectedDeposit.confirmationAnswers).length > 0 && (
                            <div className="mt-6 border-t dark:border-gray-800 pt-4 md:col-span-2">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">Submitted Verification Answers</h4>
                                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(selectedDeposit.confirmationAnswers).map(([label, value]) => (
                                        <div key={label} className="text-xs">
                                            <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 block mb-1">{label}:</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-150 font-mono break-all">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                         {selectedDeposit.userNotes && (
                             <div className="mt-6">
                                <h4 className="font-semibold mb-2">User Notes:</h4>
                                <p className="text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600">{selectedDeposit.userNotes}</p>
                            </div>
                         )}

                        {selectedDeposit.status === Status.Rejected && selectedDeposit.adminNotes && (
                            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs">
                                <span className="font-bold text-red-600 dark:text-red-400 block uppercase tracking-wide">Recorded Rejection Reason:</span>
                                <p className="text-red-800 dark:text-red-300 mt-1 font-medium">{selectedDeposit.adminNotes}</p>
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