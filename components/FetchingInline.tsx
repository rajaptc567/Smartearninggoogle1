import React from 'react';
import { useData } from '../hooks/useData';

interface FetchingInlineProps {
    messageType: string;
    overlay?: boolean;
    customLabel?: string;
}

export const FetchingInline: React.FC<FetchingInlineProps> = ({ messageType, overlay = false, customLabel }) => {
    // Safely destructure context
    const context = useData();
    const fetchingMessages = (context as any).fetchingMessages || [];
    const isFetching = fetchingMessages.includes(messageType);

    if (!isFetching) return null;

    if (overlay) {
        return (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-xs select-none rounded-[inherit] transition-all p-4">
                <SpinnerContainer message={customLabel || messageType} />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-6 my-4 select-none bg-slate-800/10 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl animate-fade-in">
            <SpinnerContainer message={customLabel || messageType} />
        </div>
    );
};

const SpinnerContainer: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div className="flex flex-col items-center space-y-3 text-center">
            {/* Loader Circle */}
            <div className="relative flex items-center justify-center w-14 h-14">
                {/* Glowing background */}
                <div className="absolute inset-0 bg-orange-600/15 rounded-full blur-md animate-pulse"></div>
                
                {/* Ring Container */}
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-700/50"></div>
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#f97316] border-r-[#f97316]/30 animate-spin" style={{ animationDuration: '0.7s' }}></div>
                
                {/* Inner Central Circle */}
                <div className="absolute inset-1 bg-[#121f35] rounded-full flex items-center justify-center shadow-inner border border-slate-700/20">
                    <svg className="w-5 h-5 text-[#f97316] fill-none stroke-current animate-pulse" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.2 8H18" />
                    </svg>
                </div>
            </div>

            <div className="space-y-0.5">
                <p className="text-[8px] uppercase tracking-[0.25em] font-black text-slate-500 font-mono">Syncing Database</p>
                <h4 className="text-xs font-black tracking-widest text-[#f97316] uppercase font-mono drop-shadow-[0_0_6px_rgba(249,115,22,0.3)] animate-pulse">
                    {message}
                </h4>
            </div>
        </div>
    );
};

export default FetchingInline;
