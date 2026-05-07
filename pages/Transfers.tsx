import React, { useState, useEffect, useMemo } from 'react';
import { Transfer, Status, formatCurrency, Currency } from '../types';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { updateTransfer } from '../services/api';

const Transfers: React.FC = () => {
    const { state, dispatch } = useData();
    const { transfers } = state;

    const tableHeaders = ['ID', 'Sender', 'Recipient', 'Amount', 'Status', 'Date'];
    
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [currentStatus, setCurrentStatus] = useState<Transfer['status']>(Status.Pending);
    const [isSaving, setIsSaving] = useState(false);
    
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<Currency | ''>('PKR');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    useEffect(() => {
        if (selectedTransfer) {
            setAdminNotes(selectedTransfer.adminNotes || '');
            setCurrentStatus(selectedTransfer.status);
        }
    }, [selectedTransfer]);

    // Filter Logic
    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            const matchesSearch = 
                t._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.amount.toString().includes(searchTerm);
            
            const matchesStatus = statusFilter ? t.status === statusFilter : true;
            const matchesCurrency = currencyFilter ? t.currency?.toUpperCase() === currencyFilter : true;

            return matchesSearch && matchesStatus && matchesCurrency;
        });
    }, [transfers, searchTerm, statusFilter, currencyFilter]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, currencyFilter, itemsPerPage]);

    // Pagination Calculation
    const totalItems = filteredTransfers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedTransfers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransfers.slice(start, start + itemsPerPage);
    }, [filteredTransfers, currentPage, itemsPerPage]);

    const handleSaveChanges = async () => {
        if (selectedTransfer) {
            setIsSaving(true);
            try {
                const result = await updateTransfer(selectedTransfer._id, {
                    status: currentStatus,
                    adminNotes,
                });

                // The API returns the updated transfer and potentially affected users and new transactions.
                dispatch({ type: 'UPDATE_TRANSFER', payload: result.transfer });
                if (result.sender) dispatch({ type: 'UPDATE_USER', payload: result.sender });
                if (result.recipient) dispatch({ type: 'UPDATE_USER', payload: result.recipient });
                if (result.transaction) dispatch({ type: 'ADD_TRANSACTION', payload: result.transaction });

                handleCloseDetailModal();
            } catch (error) {
                console.error("Failed to update transfer:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'Could not update transfer.'}`);
            } finally {
                setIsSaving(false);
            }
        }
    };
    
    const handleRowClick = (transfer: Transfer) => {
        setSelectedTransfer(transfer);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedTransfer(null);
        setAdminNotes('');
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">User to User Transfers</h2>
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
                        placeholder="Search by ID, Sender, Recipient..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <Table headers={tableHeaders}>
                    {paginatedTransfers.map((transfer: Transfer) => (
                        <tr 
                        key={transfer._id} 
                        className="text-gray-700 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                        onClick={() => handleRowClick(transfer)}
                        >
                            <td className="px-4 py-3 text-xs font-mono">{transfer._id.substring(0, 8)}...</td>
                            <td className="px-4 py-3">{transfer.senderName}</td>
                            <td className="px-4 py-3">{transfer.recipientName}</td>
                            <td className="px-4 py-3">{formatCurrency(transfer.amount, transfer.currency)}</td>
                            <td className="px-4 py-3"><Badge status={transfer.status} /></td>
                            <td className="px-4 py-3 text-sm">{new Date(transfer.date).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </Table>

                {/* Pagination Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t dark:border-gray-700 pt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> transfers
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

            {selectedTransfer && (
                 <Modal isOpen={isDetailModalOpen} onClose={handleCloseDetailModal}>
                    <div className="p-2 sm:p-4 text-gray-800 dark:text-gray-200">
                        <h3 className="text-xl font-bold mb-4">Transfer Details - <span className="text-blue-600 dark:text-blue-400">{selectedTransfer._id}</span></h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                            <div><span className="font-semibold">Sender:</span> {selectedTransfer.senderName}</div>
                            <div><span className="font-semibold">Recipient:</span> {selectedTransfer.recipientName}</div>
                            <div><span className="font-semibold">Amount:</span> {formatCurrency(selectedTransfer.amount, selectedTransfer.currency)}</div>
                            <div><span className="font-semibold">Fee:</span> {formatCurrency(selectedTransfer.fee || 0, selectedTransfer.currency)}</div>
                            <div className="md:col-span-2"><span className="font-semibold">Date:</span> {new Date(selectedTransfer.date).toLocaleString()}</div>
                        </div>

                         <div className="mt-6">
                            <label htmlFor="status" className="block text-sm font-semibold mb-2">Status</label>
                            <select 
                                id="status" 
                                value={currentStatus} 
                                onChange={(e) => setCurrentStatus(e.target.value as Transfer['status'])}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value={Status.Pending}>Pending</option>
                                <option value={Status.Approved}>Approved</option>
                                <option value={Status.Rejected}>Rejected</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                <strong>Approved:</strong> Recipient receives funds. <br/>
                                <strong>Rejected:</strong> Sender gets a refund (including fee).
                            </p>
                        </div>

                         <div className="mt-6">
                            <label htmlFor="adminNotes" className="block text-sm font-semibold mb-2">Admin Notes</label>
                            <textarea
                                id="adminNotes"
                                rows={3}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Add remarks..."
                            />
                        </div>

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

export default Transfers;