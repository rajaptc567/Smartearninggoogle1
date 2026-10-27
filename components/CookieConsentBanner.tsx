import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

declare global {
  interface Window {
    setSmartExnAnalyticsConsent?: (choice: 'granted' | 'denied') => void;
  }
}

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('smartexn_cookie_consent');
      // Only show banner if the user has NOT made an explicit choice yet
      if (!stored) {
        setIsVisible(true);
      }
    } catch {
      // Storage access blocked or restricted; fail safe without displaying or assuming consent
    }

    const handleConsentChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ choice: 'granted' | 'denied' }>;
      if (customEvent.detail?.choice) {
        setIsVisible(false);
      }
    };

    window.addEventListener('smartexn_consent_change', handleConsentChange);
    return () => {
      window.removeEventListener('smartexn_consent_change', handleConsentChange);
    };
  }, []);

  if (!isVisible) return null;

  const handleChoice = (choice: 'granted' | 'denied') => {
    if (typeof window.setSmartExnAnalyticsConsent === 'function') {
      window.setSmartExnAnalyticsConsent(choice);
    } else {
      try {
        localStorage.setItem('smartexn_cookie_consent', choice);
      } catch {}
    }
    setIsVisible(false);
  };

  return (
    <aside
      aria-label="Cookie and Privacy Consent"
      role="region"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-fadeIn"
    >
      <div className="bg-[#09182b] text-slate-200 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 select-none" aria-hidden="true">🍪</span>
          <div className="flex-1 text-xs leading-relaxed space-y-1">
            <p className="font-semibold text-white">Privacy & Cookie Preferences</p>
            <p className="text-slate-300">
              We use essential cookies for secure authentication. We also request permission for optional Google Analytics to measure site performance.{' '}
              <Link
                to="/privacy-policy?tab=cookie"
                className="text-sky-400 hover:text-sky-300 underline font-medium"
              >
                Cookie Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleChoice('denied')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 font-medium transition-colors cursor-pointer"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleChoice('granted')}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500 font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Accept Analytics
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
