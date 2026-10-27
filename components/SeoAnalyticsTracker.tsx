import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { seoAnalytics, sanitizePublicPath, getSeoClusterFromPath, hasAnalyticsConsent } from '../services/seoAnalytics';

/**
 * SeoAnalyticsTracker
 * 
 * Automatically tracks public SPA route transitions for Google Analytics 4
 * and organic search landing performance without leaking any private member or financial data.
 * 
 * Strictly respects user privacy and consent:
 * - Does not dispatch or queue route tracking before explicit consent.
 * - Listens for consent grants so current route can be tracked once approved.
 */
export const SeoAnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const lastPathRef = useRef<string>('');

  useEffect(() => {
    const currentPath = sanitizePublicPath(location.pathname);

    // Prevent duplicate triggers if path has not changed
    if (lastPathRef.current === currentPath) {
      return;
    }

    lastPathRef.current = currentPath;

    // Only track public paths
    const cluster = getSeoClusterFromPath(currentPath);
    if (cluster === 'private') {
      return;
    }

    // Suppress route tracking if analytics consent is not explicitly granted
    if (!hasAnalyticsConsent()) {
      return;
    }

    // Small timeout to allow document.title and SEOHead tags to update
    const timer = setTimeout(() => {
      seoAnalytics.trackPageView(currentPath, document.title);
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // When user grants consent, track current page view if on a public path
  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ choice: 'granted' | 'denied' }>;
      if (customEvent.detail?.choice === 'granted') {
        const currentPath = sanitizePublicPath(location.pathname);
        const cluster = getSeoClusterFromPath(currentPath);
        if (cluster !== 'private') {
          seoAnalytics.trackPageView(currentPath, document.title);
        }
      }
    };

    window.addEventListener('smartexn_consent_change', handleConsentChange);
    return () => {
      window.removeEventListener('smartexn_consent_change', handleConsentChange);
    };
  }, [location.pathname]);

  return null;
};
