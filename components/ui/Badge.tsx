
import React from 'react';
import { Status } from '../../types';

interface BadgeProps {
  // FIX: Changed status to string to handle various string literal unions from different models and components
  status: string;
}

// FIX: Updated statusColors to use string index and added Currency support for TickerSettings
const statusColors: { [key: string]: string } = {
  [Status.Active]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [Status.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [Status.Blocked]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [Status.Approved]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [Status.Rejected]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [Status.Paid]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  [Status.Disabled]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  [Status.Matching]: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  [Status.Paused]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  [Status.Open]: 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
  [Status.Processing]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  [Status.Resolved]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [Status.Closed]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  'Enabled': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  // Currency Support for TickerSettings
  'USD': 'bg-green-50 text-green-600 border border-green-200',
  'PKR': 'bg-teal-50 text-teal-600 border border-teal-200',
  'EUR': 'bg-indigo-50 text-indigo-600 border border-indigo-200',
};

const Badge: React.FC<BadgeProps> = ({ status }) => {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

export default Badge;
