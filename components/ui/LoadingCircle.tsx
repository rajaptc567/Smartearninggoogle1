import React, { useState, useEffect } from 'react';

/**
 * A beautiful, colorful, and localized circular spinner accompanied by a glowing status bar.
 * Designed to replace blank areas during partial/component data fetching.
 */
interface LoadingCircleProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const LoadingCircle: React.FC<LoadingCircleProps> = ({ 
    text = "Fetching requested data...", 
    size = 'md',
    className = "" 
}) => {
    // Unique gradient ID per instance to enforce localized SVG settings and prevent defs clashing
    const [gradientId] = useState(() => `local-spinner-grad-${Math.floor(Math.random() * 1000000)}`);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 95) return prev;
                const step = prev < 40 ? 5 : prev < 75 ? 3 : 1;
                return Math.min(prev + step, 95);
            });
        }, 60);
        return () => clearInterval(interval);
    }, []);

    const sizeClasses = {
        sm: {
            spinner: "w-8 h-8",
            stroke: "stroke-[3px]"
        },
        md: {
            spinner: "w-14 h-14",
            stroke: "stroke-[4px]"
        },
        lg: {
            spinner: "w-20 h-20",
            stroke: "stroke-[5px]"
        }
    };

    return (
        <div className={`p-8 flex flex-col items-center justify-center text-center w-full min-h-[220px] transition-all duration-500 ease-out ${className}`} id="local-loading-circle-container">
            {/* Custom Styles Injection */}
            <style>{`
                @keyframes local-dash {
                    0% { stroke-dashoffset: 240; }
                    50% { stroke-dashoffset: 60; transform: rotate(135deg); }
                    100% { stroke-dashoffset: 240; transform: rotate(450deg); }
                }
                @keyframes bar-flow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .local-spinner-circle {
                    stroke-dasharray: 280;
                    stroke-dashoffset: 75;
                    transform-origin: center;
                    animation: local-dash 1.6s ease-in-out infinite;
                }
                .loader-bar-glow {
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
                    background-size: 300% 300%;
                    animation: bar-flow 3s ease infinite;
                }
            `}</style>

            <div className="relative flex items-center justify-center mb-5" id="spinner-mesh">
                {/* Background Rotating Ring decoration */}
                <div className={`absolute rounded-full border border-gray-100 dark:border-gray-800 opacity-20 animate-ping ${sizeClasses[size].spinner}`} />
                
                {/* Main Spinning SVG Ring with Multi-Color Gradient */}
                <svg 
                    className={`animate-spin text-blue-500 ${sizeClasses[size].spinner}`} 
                    viewBox="0 0 100 100" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" strokeLinecap="round" />      {/* Blue */}
                            <stop offset="50%" stopColor="#8b5cf6" />     {/* Purple */}
                            <stop offset="100%" stopColor="#ec4899" />    {/* Pink */}
                        </linearGradient>
                    </defs>
                    {/* Secondary background trail */}
                    <circle 
                        className="opacity-10" 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                    />
                    {/* Gradient Active Segment */}
                    <circle 
                        className={`local-spinner-circle`} 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        stroke={`url(#${gradientId})`} 
                        strokeWidth="8" 
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {/* Glowing Text */}
            <p className="text-sm md:text-base font-semibold text-gray-700 dark:text-gray-300 tracking-wide mb-3 animate-pulse" id="loading-text-label">
                {text} {progress}%
            </p>

            {/* Glowing Localized Status/Progress Bar */}
            <div className="w-44 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner relative" id="progressbar-container">
                <div 
                    className="absolute top-0 left-0 h-full loader-bar-glow rounded-full opacity-90 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

interface FullPageLoaderProps {
    isDataLoading: boolean;
    onFinished: () => void;
}

/**
 * Premium Full-Page loading screen featuring stylized brand greetings,
 * elegant layout, tagline, and animated progress handlers.
 */
export const FullPageLoader: React.FC<FullPageLoaderProps> = ({ 
    isDataLoading, 
    onFinished 
}) => {
    const [progress, setProgress] = useState<number>(0);
    const [statusText, setStatusText] = useState<string>("Initializing secure handshake...");
    const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

    // Progression timer to allow greeting and tagline to show beautifully
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                // Vary speed step-by-step
                const increment = prev < 30 ? 4 : prev < 70 ? 2 : prev < 90 ? 1 : 0.5;
                const nextProgress = Math.min(prev + increment, 100);

                // Update premium informational statuses based on loading steps
                if (nextProgress < 25) {
                    setStatusText("Contacting decentralized nodes...");
                } else if (nextProgress < 50) {
                    setStatusText("Verifying encrypted session layers...");
                } else if (nextProgress < 75) {
                    setStatusText("Hydrating core portfolios & network systems...");
                } else if (nextProgress < 95) {
                    setStatusText("Finalizing custom client workspace...");
                } else {
                    setStatusText("System ready.");
                }

                return nextProgress;
            });
        }, 35);

        return () => clearInterval(interval);
    }, []);

    // Check complete state once progress is 100 AND real background API promises have settled
    useEffect(() => {
        if (progress === 100 && !isDataLoading) {
            // Smoothly initiate fade-out animation sequence before unmounting
            setIsFadingOut(true);
            const fadeTimeout = setTimeout(() => {
                onFinished();
            }, 600); // matches fadeOut animation duration
            return () => clearTimeout(fadeTimeout);
        }
    }, [progress, isDataLoading, onFinished]);

    return (
        <div 
            className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-all duration-700 ease-out ${
                isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
            }`} 
            id="full-page-loader-screen"
        >
            {/* Styling Injector for Unique Keyframes */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.4)); opacity: 0.9; }
                    50% { filter: drop-shadow(0 0 25px rgba(236, 72, 153, 0.6)); opacity: 1; }
                }
                @keyframes orbital-glow-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes subtle-float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                .brand-glow {
                    animation: pulse-glow 4s ease-in-out infinite;
                }
                .loader-orbital-ring {
                    transform-origin: center;
                    animation: orbital-glow-spin 2s linear infinite;
                }
                .float-banner {
                    animation: subtle-float 5s ease-in-out infinite;
                }
                .animated-full-status-bar {
                    background: linear-gradient(90deg, #3b82f6, #a855f7, #ec4899, #3b82f6);
                    background-size: 200% 100%;
                    animation: bar-flow 2.5s linear infinite;
                }
            `}</style>

            {/* Glowing background matrix decorative elements */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex flex-col items-center max-w-lg px-6 text-center float-banner relative" id="loader-inner-content">
                {/* App Main Spinning Core */}
                <div className="relative flex items-center justify-center mb-10" id="brand-spinner-mesh">
                    {/* Ring Outer Ambient Halo */}
                    <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-xl animate-pulse" />
                    
                    {/* Background Ring structure */}
                    <svg className="w-24 h-24 loader-orbital-ring" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="orbitalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="50%" stopColor="#8b5cf6" />
                                <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                        </defs>
                        <circle 
                            className="text-slate-800" 
                            cx="50" 
                            cy="50" 
                            r="44" 
                            stroke="currentColor" 
                            strokeWidth="4" 
                        />
                        <circle 
                            cx="50" 
                            cy="50" 
                            r="44" 
                            stroke="url(#orbitalGradient)" 
                            strokeWidth="5" 
                            strokeLinecap="round"
                            strokeDasharray="180 80"
                        />
                    </svg>

                    {/* Inside Center Percentage Indicator */}
                    <div className="absolute flex flex-col items-center justify-center text-white" id="progress-indicator">
                        <span className="font-mono text-xl font-black bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">
                            {Math.floor(progress)}%
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sync</span>
                    </div>
                </div>

                {/* Greeting texts */}
                <h2 className="text-sm font-black text-blue-500 uppercase tracking-[0.3em] mb-3 animate-pulse" id="greeting-accent">
                    WELCOME TO SMARTEARNING
                </h2>

                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight leading-none mb-1 md:text-5xl" id="greeting-logo">
                    SmartEarning
                </h1>

                {/* Domain name */}
                <p className="text-xs font-mono text-slate-500 hover:text-slate-400 tracking-wider transition-colors mb-5 uppercase" id="domain-address">
                    www.smartearning.com
                </p>

                {/* Signature Tagline */}
                <div className="h-[2px] w-12 bg-gradient-to-r from-blue-500 to-pink-500 rounded-full mb-5 opacity-80" id="divider" />
                
                <p className="text-base text-slate-300 font-medium italic tracking-wide max-w-sm mb-10 leading-relaxed md:text-lg" id="loader-tagline">
                    "Invest in Your Future, Grow Your Network"
                </p>

                {/* Progress Indicators Container */}
                <div className="w-64 flex flex-col items-center gap-2" id="loader-status-container">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase animate-pulse min-h-[16px] text-center">
                        {statusText}
                    </span>
                    
                    {/* Status/Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-lg relative" id="loader-bar-mesh">
                        {/* Interactive Growing Loader Bar */}
                        <div 
                            className="absolute top-0 left-0 h-full animated-full-status-bar rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-all duration-100" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                    
                    <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase mt-1">
                        Secure Multi-Node Connection
                    </span>
                </div>
            </div>
        </div>
    );
};
