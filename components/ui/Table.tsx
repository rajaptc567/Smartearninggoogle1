
import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

const Table: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="text-[10px] sm:text-xs font-black tracking-widest text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/50">
              {headers.map((header) => (
                <th key={header} className="px-4 py-4 sm:px-6">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;