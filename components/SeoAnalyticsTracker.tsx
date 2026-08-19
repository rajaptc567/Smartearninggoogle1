import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { seoAnalytics, sanitizePublicPath, getSeoClusterFromPath } from '../services/seoAnalytics';

/**
 * SeoAnalyticsTracker
 * 
 * Automatically tracks public SPA route transitions for Google Analytics 4
 * and organic search landing performance without leaking any private member or financial data.
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

    // Small timeout to allow document.title and SEOHead tags to update
    const timer = setTimeout(() => {
      seoAnalytics.trackPageView(currentPath, document.title);
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
};
