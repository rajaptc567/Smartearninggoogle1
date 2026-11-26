import React, { useState, useEffect } from 'react';
import { AlertCircle as AlertIcon, RefreshCw as RefreshIcon } from 'lucide-react';
import { isSafeImageIcon } from '../utils/pageExperienceHelper';

export interface ProviderNavItem {
    id: string;
    label: string;
    icon?: string;
    badge?: string;
    verifiedOfferCount: number | null;
    countLabel?: string;
    isSelected: boolean;
    isLaunching?: boolean;
    onSelect: () => void;
}

export interface ProviderNavSelectAllOption {
    id: string;
    label: string;
    countBadge?: string | null;
    isSelected: boolean;
    onSelect: () => void;
}

export interface ProviderNavRowProps {
    variant: 'cards' | 'tabs' | 'icons';
    ariaLabel: string;
    title?: string;
    subtitle?: string;
    items: ProviderNavItem[];
    selectAllTab?: ProviderNavSelectAllOption;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    className?: string;
}

const ProviderNavIcon: React.FC<{
    icon?: string;
    label: string;
    isLaunching?: boolean;
    sizeClass?: string;
    emojiClass?: string;
}> = ({ icon, label, isLaunching = false, sizeClass = 'w-5 h-5 rounded-md', emojiClass = 'text-sm' }) => {
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [icon]);

    if (isLaunching) {
        return (
            <span className={`${emojiClass} leading-none shrink-0`} aria-hidden="true">
                ⏳
            </span>
        );
    }

    if (icon && isSafeImageIcon(icon) && !imgFailed) {
        return (
            <img
                src={icon.trim()}
                alt={label}
                onError={() => setImgFailed(true)}
                className={`${sizeClass} object-cover shrink-0 bg-slate-900/60`}
            />
        );
    }

    return (
        <span className={`${emojiClass} leading-none shrink-0`} aria-hidden="true">
            {icon && !isSafeImageIcon(icon) ? icon : '⚡'}
        </span>
    );
};

export const ProviderNavRow: React.FC<ProviderNavRowProps> = ({
    variant,
    ariaLabel,
    title,
    subtitle,
    items,
    selectAllTab,
    isLoading = false,
    error = null,
    onRetry,
    className = ''
}) => {
    if (isLoading) {
        return (
            <div
                aria-busy="true"
                aria-label={ariaLabel}
                className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2.5 ${className}`}
            >
                {title && (
                    <div className="h-3.5 w-40 bg-slate-800 rounded animate-pulse" />
                )}
                <div className="flex items-center gap-2 overflow-hidden">
                    {[1, 2, 3, 4].map(idx => (
                        <div
                            key={idx}
                            className={`bg-slate-800/70 border border-slate-700/50 rounded-xl animate-pulse shrink-0 ${
                                variant === 'cards'
                                    ? 'h-16 w-28 sm:w-32'
                                    : variant === 'icons'
                                        ? 'h-16 w-20 sm:w-24'
                                        : 'h-10 w-28 sm:w-32'
                            }`}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                role="alert"
                className={`bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200 ${className}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <AlertIcon className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold truncate">{error}</span>
                </div>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1.5 shrink-0 min-h-[36px]"
                    >
                        <RefreshIcon className="w-3.5 h-3.5" />
                        <span>Retry</span>
                    </button>
                )}
            </div>
        );
    }

    if (!selectAllTab && items.length === 0) {
        return null;
    }

    if (variant === 'cards') {
        return (
            <div
                data-nav-variant="cards"
                className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-4 space-y-2 sm:space-y-2.5 ${className}`}
            >
                {(title || subtitle) && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-0.5">
                        <div>
                            {title && (
                                <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                                    {title}
                                </h4>
                            )}
                            {subtitle && (
                                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold sm:hidden">
                            Swipe &rarr;
                        </span>
                    </div>
                )}

                <div
                    role="tablist"
                    aria-label={ariaLabel}
                    className="flex items-stretch gap-1.5 sm:gap-2.5 overflow-x-auto snap-x snap-mandatory pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {selectAllTab && (
                        <button
                            key={selectAllTab.id}
                            type="button"
                            role="tab"
                            aria-selected={selectAllTab.isSelected}
                            onClick={selectAllTab.onSelect}
                            className={`min-w-[96px] max-w-[130px] sm:min-w-[126px] sm:max-w-[160px] shrink-0 snap-start rounded-xl sm:rounded-2xl p-2 sm:p-3 border text-left transition-all flex flex-col justify-between gap-1.5 sm:gap-2 min-h-[60px] sm:min-h-[68px] ${
                                selectAllTab.isSelected
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30'
                                    : 'bg-slate-950/80 text-slate-200 border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1.5 w-full">
                                <span className="text-base sm:text-lg leading-none" aria-hidden="true">✨</span>
                                {selectAllTab.countBadge && (
                                    <span
                                        className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-bold font-mono ${
                                            selectAllTab.isSelected
                                                ? 'bg-slate-950/90 text-amber-300'
                                                : 'bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                        {selectAllTab.countBadge}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider truncate ${
                                    selectAllTab.isSelected ? 'text-slate-950' : 'text-white'
                                }`}
                            >
                                {selectAllTab.label}
                            </span>
                        </button>
                    )}

                    {items.map(item => {
                        const hasVerifiedCount =
                            typeof item.verifiedOfferCount === 'number' && Number.isFinite(item.verifiedOfferCount);
                        const displayCount = hasVerifiedCount
                            ? String(item.verifiedOfferCount)
                            : item.countLabel;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={item.isSelected}
                                disabled={item.isLaunching}
                                onClick={item.onSelect}
                                className={`min-w-[96px] max-w-[136px] sm:min-w-[136px] sm:max-w-[190px] shrink-0 snap-start rounded-xl sm:rounded-2xl p-2 sm:p-3 border text-left transition-all flex flex-col justify-between gap-1.5 sm:gap-2 min-h-[60px] sm:min-h-[68px] ${
                                    item.isSelected
                                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30'
                                        : 'bg-slate-950/80 text-slate-200 border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1.5 w-full">
                                    <ProviderNavIcon
                                        icon={item.icon}
                                        label={item.label}
                                        isLaunching={item.isLaunching}
                                        sizeClass="w-6 h-6 sm:w-7 sm:h-7 rounded-lg"
                                        emojiClass="text-base sm:text-lg"
                                    />
                                    {displayCount && (
                                        <span
                                            className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-bold font-mono truncate max-w-[78px] ${
                                                item.isSelected
                                                    ? 'bg-slate-950/90 text-amber-300'
                                                    : hasVerifiedCount
                                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                                                        : 'bg-slate-800 text-slate-300'
                                            }`}
                                        >
                                            {displayCount}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <span
                                        className={`block text-[11px] sm:text-xs font-extrabold truncate ${
                                            item.isSelected ? 'text-slate-950' : 'text-white'
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                    {item.badge && (
                                        <span
                                            className={`block text-[9px] font-semibold truncate mt-0.5 ${
                                                item.isSelected ? 'text-slate-900/80' : 'text-slate-400'
                                            }`}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (variant === 'icons') {
        return (
            <div
                data-nav-variant="icons"
                className={`bg-slate-950/70 border border-slate-800/90 rounded-2xl p-1.5 sm:p-3 ${className}`}
            >
                <div
                    role="tablist"
                    aria-label={ariaLabel}
                    className="flex items-stretch gap-1.5 sm:gap-2.5 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {selectAllTab && (
                        <button
                            key={selectAllTab.id}
                            type="button"
                            role="tab"
                            aria-selected={selectAllTab.isSelected}
                            onClick={selectAllTab.onSelect}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 shrink-0 snap-start min-h-[60px] sm:min-h-[68px] ${
                                selectAllTab.isSelected
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                            }`}
                        >
                            <span>{selectAllTab.label}</span>
                            {selectAllTab.countBadge && (
                                <span
                                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                                        selectAllTab.isSelected
                                            ? 'bg-slate-950/90 text-amber-300'
                                            : 'bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    {selectAllTab.countBadge}
                                </span>
                            )}
                        </button>
                    )}

                    {items.map(item => {
                        const hasVerifiedCount =
                            typeof item.verifiedOfferCount === 'number' && Number.isFinite(item.verifiedOfferCount);

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={item.isSelected}
                                aria-label={item.label}
                                title={item.label}
                                disabled={item.isLaunching}
                                onClick={item.onSelect}
                                className={`relative min-w-[74px] max-w-[96px] sm:min-w-[78px] sm:max-w-[104px] px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 sm:gap-1.5 shrink-0 snap-start min-h-[60px] sm:min-h-[68px] border ${
                                    item.isSelected
                                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 hover:text-white'
                                }`}
                            >
                                {hasVerifiedCount && (
                                    <span
                                        className={`absolute top-1 right-1 text-[9px] px-1 py-0.2 rounded font-mono font-bold leading-tight ${
                                            item.isSelected
                                                ? 'bg-slate-950/90 text-amber-300'
                                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        }`}
                                    >
                                        {item.verifiedOfferCount}
                                    </span>
                                )}
                                <div
                                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden border ${
                                        item.isSelected
                                            ? 'bg-slate-950/15 border-slate-950/20'
                                            : 'bg-slate-950/80 border-slate-800'
                                    }`}
                                >
                                    <ProviderNavIcon
                                        icon={item.icon}
                                        label={item.label}
                                        isLaunching={item.isLaunching}
                                        sizeClass="w-7 h-7 sm:w-9 sm:h-9 rounded-lg"
                                        emojiClass="text-base sm:text-xl"
                                    />
                                </div>
                                <span className="text-[10px] font-bold truncate w-full text-center leading-tight">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            data-nav-variant="tabs"
            className={`bg-slate-950/70 border border-slate-800/90 rounded-2xl p-1.5 sm:p-2.5 ${className}`}
        >
            <div
                role="tablist"
                aria-label={ariaLabel}
                className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
                {selectAllTab && (
                    <button
                        key={selectAllTab.id}
                        type="button"
                        role="tab"
                        aria-selected={selectAllTab.isSelected}
                        onClick={selectAllTab.onSelect}
                        className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 snap-start min-h-[36px] sm:min-h-[40px] ${
                            selectAllTab.isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        <span>{selectAllTab.label}</span>
                        {selectAllTab.countBadge && (
                            <span
                                className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                                    selectAllTab.isSelected
                                        ? 'bg-slate-950/90 text-amber-300'
                                        : 'bg-slate-800 text-slate-400'
                                }`}
                            >
                                {selectAllTab.countBadge}
                            </span>
                        )}
                    </button>
                )}

                {items.map(item => {
                    const hasVerifiedCount =
                        typeof item.verifiedOfferCount === 'number' && Number.isFinite(item.verifiedOfferCount);

                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={item.isSelected}
                            disabled={item.isLaunching}
                            onClick={item.onSelect}
                            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 snap-start min-h-[36px] sm:min-h-[40px] ${
                                item.isSelected
                                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-500/40 hover:text-white'
                            }`}
                        >
                            <ProviderNavIcon
                                icon={item.icon}
                                label={item.label}
                                isLaunching={item.isLaunching}
                                sizeClass="w-4 h-4 sm:w-5 sm:h-5 rounded"
                                emojiClass="text-sm"
                            />
                            <span className="truncate max-w-[130px] sm:max-w-[180px]">{item.label}</span>
                            {hasVerifiedCount && (
                                <span
                                    className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                                        item.isSelected
                                            ? 'bg-slate-950/90 text-amber-300'
                                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                                    }`}
                                >
                                    {item.verifiedOfferCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ProviderNavRow;
