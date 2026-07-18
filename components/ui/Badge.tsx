

import React from 'react';
import { Status } from '../../types';

interface BadgeProps {
  status?: Status | 'Enabled' | 'Disabled';
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'primary' | 'secondary';
  className?: string;
  children?: React.ReactNode;
}

// FIX: Added 'Matching' and 'Paused' status to support all possible Status enum values.
const statusColors: { [key in Status | 'Enabled' | 'Disabled']: string } = {
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
};

const variantColors = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-500/20',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-500/20',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-500/20',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-500/20',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-600/20',
  primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-500/20',
  secondary: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-700/20',
};

const Badge: React.FC<BadgeProps> = ({ status, variant, className = '', children }) => {
  if (variant) {
    const colorClass = variantColors[variant] || variantColors.gray;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${colorClass} ${className}`}>
        {children}
      </span>
    );
  }

  const colorClass = status ? (statusColors[status] || 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${colorClass} ${className}`}>
      {children || status}
    </span>
  );
};

export default Badge;