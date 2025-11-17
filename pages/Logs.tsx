import React from 'react';
import Table from '../components/ui/Table';
import { useData } from '../hooks/useData';
import { Log } from '../types';

const Logs: React.FC = () => {
    const { state } = useData();
    const { logs } = state;
    
    const tableHeaders = ['Timestamp', 'Action', 'Affected User', 'Details', 'Performed By'];

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">System Logs</h2>
            <Table headers={tableHeaders}>
                {logs.map((log: Log) => (
                     <tr key={log._id} className="text-gray-700 dark:text-gray-400">
                        <td className="px-4 py-3 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">{log.action}</td>
                        <td className="px-4 py-3 text-sm">{log.affectedUser}</td>
                        <td className="px-4 py-3 text-sm">{log.details}</td>
                        <td className="px-4 py-3 text-sm">{log.performedBy}</td>
                    </tr>
                ))}
            </Table>
        </div>
    );
};

export default Logs;