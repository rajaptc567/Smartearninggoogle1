
import React from 'react';
import { Status } from '../../types';

interface BadgeProps {
  status: Status | 'Enabled' | 'Disabled' | 'hold_slot' | 'hold_upgrade' | 'overflow';
}

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
  'hold_slot': 'bg-amber-100 text-amber-800 border border-amber-200 font-bold',
  'hold_upgrade': 'bg-orange-100 text-orange-800 border border-orange-200 font-bold',
  'overflow': 'bg-gray-200 text-gray-600 border border-gray-300 italic'
};

const Badge: React.FC<BadgeProps> = ({ status }) => {
  const displayLabel = status.replace('_', ' ').toUpperCase();
  return (
    <span className={`px-2 py-1 text-[10px] font-medium rounded-full ${statusColors[status] || 'bg-gray-100'}`}>
      {displayLabel}
    </span>
  );
};

export default Badge;
