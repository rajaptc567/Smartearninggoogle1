import React, { useState, useMemo } from 'react';
import { User, InvestmentPlan, formatCurrency } from '../types';
import { Search, Filter, Check, X, Shield, Globe, Award, Trash2, UserPlus, Users, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';

interface AdminInvestmentWhitelistManagerProps {
    whitelistedUserIds: string[];
    onUpdateWhitelist: (newIds: string[]) => void;
    users: User[];
    investmentPlans?: InvestmentPlan[];
}

export const AdminInvestmentWhitelistManager: React.FC<AdminInvestmentWhitelistManagerProps> = ({
    whitelistedUserIds = [],
    onUpdateWhitelist,
    users = [],
    investmentPlans = []
}) => {
    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [countryFilter, setCountryFilter] = useState('ALL');
    const [planFilter, setPlanFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'WHITELISTED' | 'NOT_WHITELISTED'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [selectedUserIdsForBatch, setSelectedUserIdsForBatch] = useState<string[]>([]);

    // Normalizing whitelisted IDs as strings to prevent type mismatches
    const normalizedWhitelistSet = useMemo(() => {
        return new Set(whitelistedUserIds.map(id => String(id)));
    }, [whitelistedUserIds]);

    // Extract helper: user's active plan names
    const getUserActivePlans = (user: User): string[] => {
        const names: string[] = [];
        if (Array.isArray(user.activePlans) && user.activePlans.length > 0) {
            user.activePlans.forEach(p => {
                if (p.planName) names.push(p.planName);
                else if (p.planId) {
                    const matched = investmentPlans.find(ip => String(ip._id || ip.id) === String(p.planId));
                    names.push(matched?.name || 'Active Plan');
                }
            });
        }
        if (names.length === 0 && user.activePlan && typeof user.activePlan === 'string') {
            names.push(user.activePlan);
        }
        return names;
    };

    // Extract unique countries with member counts
    const countriesWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        users.forEach(u => {
            const country = (u.country && u.country.trim()) ? u.country.trim() : 'Unspecified';
            counts[country] = (counts[country] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
    }, [users]);

    // Whitelisted users resolved from current users list
    const whitelistedUsersList = useMemo(() => {
        return users.filter(u => {
            const id = String(u._id || (u as any).id || '');
            return normalizedWhitelistSet.has(id);
        });
    }, [users, normalizedWhitelistSet]);

    // Filtered users for directory
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const userId = String(user._id || (user as any).id || '');
            const isWhitelisted = normalizedWhitelistSet.has(userId);

            // Status filter
            if (statusFilter === 'WHITELISTED' && !isWhitelisted) return false;
            if (statusFilter === 'NOT_WHITELISTED' && isWhitelisted) return false;

            // Country filter
            if (countryFilter !== 'ALL') {
                const userCountry = (user.country && user.country.trim()) ? user.country.trim() : 'Unspecified';
                if (userCountry.toLowerCase() !== countryFilter.toLowerCase()) return false;
            }

            // Plan filter
            const activePlans = getUserActivePlans(user);
            if (planFilter === 'HAS_PLAN' && activePlans.length === 0) return false;
            if (planFilter === 'NO_PLAN' && activePlans.length > 0) return false;
            if (planFilter !== 'ALL' && planFilter !== 'HAS_PLAN' && planFilter !== 'NO_PLAN') {
                // specific plan
                const hasSpecificPlan = activePlans.some(p => p.toLowerCase() === planFilter.toLowerCase()) ||
                    (Array.isArray(user.activePlans) && user.activePlans.some(ap => String(ap.planId) === planFilter));
                if (!hasSpecificPlan) return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const name = (user.fullName || (user as any).name || '').toLowerCase();
                const username = (user.username || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const phone = (user.phone || '').toLowerCase();
                const id = userId.toLowerCase();
                const country = (user.country || '').toLowerCase();
                const planMatch = activePlans.some(p => p.toLowerCase().includes(q));

                const matches = name.includes(q) ||
                    username.includes(q) ||
                    email.includes(q) ||
                    phone.includes(q) ||
                    id.includes(q) ||
                    country.includes(q) ||
                    planMatch;

                if (!matches) return false;
            }

            return true;
        });
    }, [users, normalizedWhitelistSet, statusFilter, countryFilter, planFilter, searchQuery, investmentPlans]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage, itemsPerPage]);

    // Actions
    const handleToggleUser = (userId: string) => {
        const strId = String(userId);
        let nextIds: string[];
        if (normalizedWhitelistSet.has(strId)) {
            nextIds = whitelistedUserIds.filter(id => String(id) !== strId);
        } else {
            nextIds = Array.from(new Set([...whitelistedUserIds.map(String), strId]));
        }
        onUpdateWhitelist(nextIds);
    };

    const handleRemoveWhitelisted = (userId: string) => {
        const strId = String(userId);
        const nextIds = whitelistedUserIds.filter(id => String(id) !== strId);
        onUpdateWhitelist(nextIds);
    };

    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to remove all members from the Investment Whitelist?')) {
            onUpdateWhitelist([]);
            setSelectedUserIdsForBatch([]);
        }
    };

    const handleWhitelistAllFiltered = () => {
        const filteredIds = filteredUsers.map(u => String(u._id || (u as any).id));
        const combined = Array.from(new Set([...whitelistedUserIds.map(String), ...filteredIds]));
        onUpdateWhitelist(combined);
    };

    const handleRemoveAllFiltered = () => {
        const filteredIdsSet = new Set(filteredUsers.map(u => String(u._id || (u as any).id)));
        const remaining = whitelistedUserIds.filter(id => !filteredIdsSet.has(String(id)));
        onUpdateWhitelist(remaining);
    };

    const toggleSelectAllFiltered = () => {
        const filteredIds = filteredUsers.map(u => String(u._id || (u as any).id));
        const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedUserIdsForBatch.includes(id));
        if (allSelected) {
            setSelectedUserIdsForBatch([]);
        } else {
            setSelectedUserIdsForBatch(filteredIds);
        }
    };

    const handleWhitelistSelectedBatch = () => {
        if (selectedUserIdsForBatch.length === 0) return;
        const combined = Array.from(new Set([...whitelistedUserIds.map(String), ...selectedUserIdsForBatch]));
        onUpdateWhitelist(combined);
        setSelectedUserIdsForBatch([]);
    };

    return (
        <div className="space-y-6">
            {/* Top Section: Currently Whitelisted Members */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/20 via-blue-900/15 to-purple-900/20 border-2 border-indigo-500/40 p-4 sm:p-6 shadow-xl backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-500/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300 shadow-inner">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                    Currently Whitelisted Members
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white shadow-sm">
                                    {whitelistedUserIds.length}
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                These specific members bypass the Master Toggle and have active access to the Investment Module.
                            </p>
                        </div>
                    </div>

                    {whitelistedUserIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all shrink-0 active:scale-95"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear All Whitelisted</span>
                        </button>
                    )}
                </div>

                {/* Whitelisted Members Cards Grid */}
                {whitelistedUsersList.length > 0 ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                        {whitelistedUsersList.map(user => {
                            const userId = String(user._id || (user as any).id || '');
                            const plans = getUserActivePlans(user);
                            return (
                                <div
                                    key={userId}
                                    className="p-3 rounded-xl bg-white/90 dark:bg-gray-900/85 border border-indigo-200 dark:border-indigo-800/60 shadow-sm flex items-start justify-between gap-2.5 hover:border-indigo-400 transition-all group"
                                >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                                            {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                                    {user.fullName || user.username}
                                                </span>
                                                {user.country && (
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium shrink-0">
                                                        {user.country}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                {user.email || `@${user.username}`}
                                            </p>
                                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                {plans.length > 0 ? (
                                                    plans.map((p, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                                        >
                                                            <Award className="w-2.5 h-2.5" />
                                                            <span className="truncate max-w-[120px]">{p}</span>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                                                        No Active Plan
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveWhitelisted(userId)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                                        title="Remove from whitelist"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 p-6 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-dashed border-indigo-200 dark:border-indigo-800/40 text-center">
                        <Users className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60" />
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            No Members Currently Whitelisted
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                            Search or filter the member directory below to manually select members who should have Investment Module access while the Master Toggle is OFF.
                        </p>
                    </div>
                )}
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                            Member Directory & Whitelist Filters
                        </h4>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> members
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search Field */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search name, email, @user, ID..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Country Filter */}
                    <div>
                        <div className="relative">
                            <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={countryFilter}
                                onChange={(e) => {
                                    setCountryFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">🌍 All Countries ({users.length})</option>
                                {countriesWithCounts.map(({ country, count }) => (
                                    <option key={country} value={country}>
                                        {country} ({count})
                                    </option>
                                ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">▼</span>
                        </div>
                    </div>

                    {/* Active Plan Filter */}
                    <div>
                        <div className="relative">
                            <Award className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={planFilter}
                                onChange={(e) => {
                                    setPlanFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">📈 All Plan Statuses</option>
                                <option value="HAS_PLAN">🟢 Has Active Plan(s)</option>
                                <option value="NO_PLAN">⚪ No Active Plan</option>
                                {investmentPlans.map(p => (
                                    <option key={p._id || (p as any).id} value={p.name}>
                                        Plan: {p.name} (${p.minAmount})
                                    </option>
                                ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">▼</span>
                        </div>
                    </div>

                    {/* Whitelist Status Filter */}
                    <div>
                        <div className="relative">
                            <Shield className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">All Member Access</option>
                                <option value="NOT_WHITELISTED">Only Non-Whitelisted</option>
                                <option value="WHITELISTED">Only Whitelisted ({whitelistedUserIds.length})</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">▼</span>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleSelectAllFiltered}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold transition-all"
                        >
                            {filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIdsForBatch.includes(String(u._id || (u as any).id))) ? (
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                                <Square className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span>Select Filtered ({filteredUsers.length})</span>
                        </button>

                        {selectedUserIdsForBatch.length > 0 && (
                            <button
                                type="button"
                                onClick={handleWhitelistSelectedBatch}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm active:scale-95"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Whitelist Selected ({selectedUserIdsForBatch.length})</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleWhitelistAllFiltered}
                            disabled={filteredUsers.length === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/60 disabled:opacity-40 transition-all"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>Whitelist All Filtered</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleRemoveAllFiltered}
                            disabled={filteredUsers.length === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800/60 disabled:opacity-40 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Remove All Filtered</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Member Directory Table */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 font-black uppercase tracking-wider text-[10px]">
                                <th className="p-3 w-10 text-center">Select</th>
                                <th className="p-3">Member Details</th>
                                <th className="p-3">Country</th>
                                <th className="p-3">Active Plan(s)</th>
                                <th className="p-3 text-right">Investment Balance</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {paginatedUsers.length > 0 ? (
                                paginatedUsers.map(user => {
                                    const userId = String(user._id || (user as any).id || '');
                                    const isWhitelisted = normalizedWhitelistSet.has(userId);
                                    const isSelected = selectedUserIdsForBatch.includes(userId);
                                    const activePlans = getUserActivePlans(user);

                                    return (
                                        <tr
                                            key={userId}
                                            className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                                                isWhitelisted ? 'bg-indigo-50/30 dark:bg-indigo-950/15' : ''
                                            }`}
                                        >
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedUserIdsForBatch(prev =>
                                                            prev.includes(userId)
                                                                ? prev.filter(id => id !== userId)
                                                                : [...prev, userId]
                                                        );
                                                    }}
                                                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                                                        {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 dark:text-white truncate">
                                                            {user.fullName || user.username}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                            {user.email} <span className="opacity-75">(@{user.username})</span>
                                                        </p>
                                                        <p className="text-[9px] text-gray-400 font-mono">
                                                            ID: {userId}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-[11px]">
                                                    <Globe className="w-3 h-3 text-gray-400" />
                                                    <span>{user.country || 'Unspecified'}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {activePlans.length > 0 ? (
                                                        activePlans.map((p, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                                            >
                                                                <Award className="w-2.5 h-2.5" />
                                                                <span className="truncate">{p}</span>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                                                            No Active Plan
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <p className="font-bold text-gray-900 dark:text-white font-mono">
                                                    {formatCurrency(user.investmentBalance ?? user.walletBalance ?? 0, user.currency)}
                                                </p>
                                                {user.taskEarningsBalance !== undefined && (
                                                    <p className="text-[10px] text-gray-400">
                                                        Task: ${Number(user.taskEarningsBalance).toFixed(2)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isWhitelisted ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                                                        <Check className="w-3 h-3" />
                                                        Whitelisted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-wider">
                                                        Standard
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleUser(userId)}
                                                    className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                                                        isWhitelisted
                                                            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    }`}
                                                >
                                                    {isWhitelisted ? (
                                                        <>
                                                            <X className="w-3.5 h-3.5" />
                                                            <span>Remove</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus className="w-3.5 h-3.5" />
                                                            <span>+ Whitelist</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="font-bold text-sm text-gray-600 dark:text-gray-300">
                                            No members found matching the selected filters
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Try adjusting the search query, country, or active plan filter.
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination bar */}
                {totalPages > 1 && (
                    <div className="p-3 sm:p-4 bg-gray-50/60 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">Items per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-gray-400">
                                Page {currentPage} of {totalPages}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 3 + i;
                                    if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        type="button"
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 rounded-lg font-bold transition-all ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
