
import React, { useState, useMemo } from 'react';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { Log } from '../types';
import { clearLogs } from '../services/api';

const Logs: React.FC = () => {
    const { state, dispatch } = useData();
    const { logs } = state;
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Modal State
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [isClearing, setIsClearing] = useState(false);

    const tableHeaders = ['Time', 'Action', 'Affected User', 'Details', 'Performed By', 'View'];

    // Filter Logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = 
                log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.affectedUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.performedBy.toLowerCase().includes(searchTerm.toLowerCase());

            // Date Filter
            const logDate = new Date(log.timestamp);
            const fromDate = dateFrom ? new Date(dateFrom) : null;
            const toDate = dateTo ? new Date(dateTo) : null;
            if(toDate) toDate.setHours(23, 59, 59);

            const matchesDate = 
                (!fromDate || logDate >= fromDate) &&
                (!toDate || logDate <= toDate);

            return matchesSearch && matchesDate;
        });
    }, [logs, searchTerm, dateFrom, dateTo]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Action Color Helper
    const getActionColor = (action: string) => {
        const lower = action.toLowerCase();
        if (lower.includes('delete') || lower.includes('remove') || lower.includes('block')) return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
        if (lower.includes('create') || lower.includes('add') || lower.includes('approve')) return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
        if (lower.includes('update') || lower.includes('edit')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
        if (lower.includes('login')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    };

    const handleClearLogs = async () => {
        if (window.confirm("Are you sure you want to clear ALL system logs? This action cannot be undone.")) {
            setIsClearing(true);
            try {
                await clearLogs();
                dispatch({ type: 'SET_LOGS', payload: [] });
                alert("Logs cleared successfully.");
            } catch (error) {
                console.error(error);
                alert("Failed to clear logs.");
            } finally {
                setIsClearing(false);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">System Logs ({filteredLogs.length})</h2>
                <Button variant="danger" size="sm" onClick={handleClearLogs} disabled={isClearing || logs.length === 0}>
                    {isClearing ? 'Clearing...' : 'Clear All Logs'}
                </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Search</label>
                    <input 
                        type="text" 
                        placeholder="Search action, user, details..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">From Date</label>
                    <input 
                        type="date" 
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                        className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To Date</label>
                    <input 
                        type="date" 
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                        className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Rows Per Page</label>
                    <select 
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <Table headers={tableHeaders}>
                {paginatedLogs.map((log: Log) => (
                     <tr key={log._id} className="text-gray-700 dark:text-gray-400">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                {log.action}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{log.affectedUser}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate" title={log.details}>{log.details}</td>
                        <td className="px-4 py-3 text-sm">{log.performedBy}</td>
                        <td className="px-4 py-3 text-sm">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedLog(log)}>View</Button>
                        </td>
                    </tr>
                ))}
            </Table>
            
            {filteredLogs.length === 0 && <p className="text-center text-gray-500 py-4">No logs found matching criteria.</p>}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 border-t dark:border-gray-700 pt-4">
                    <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Prev</Button>
                        <Button size="sm" variant="secondary" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedLog && (
                <Modal isOpen={true} onClose={() => setSelectedLog(null)}>
                    <div className="p-6 w-[90vw] max-w-lg">
                        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Log Details</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                                <span className="font-bold text-gray-500">Timestamp</span>
                                <span>{new Date(selectedLog.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                                <span className="font-bold text-gray-500">Action</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(selectedLog.action)}`}>{selectedLog.action}</span>
                            </div>
                            <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                                <span className="font-bold text-gray-500">Performed By</span>
                                <span>{selectedLog.performedBy}</span>
                            </div>
                            <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                                <span className="font-bold text-gray-500">Affected User</span>
                                <span>{selectedLog.affectedUser}</span>
                            </div>
                            <div className="pt-2">
                                <span className="font-bold text-gray-500 block mb-2">Details</span>
                                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded border dark:border-gray-700 whitespace-pre-wrap font-mono text-xs text-gray-800 dark:text-gray-200 max-h-60 overflow-y-auto">
                                    {selectedLog.details}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button onClick={() => setSelectedLog(null)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Logs;
