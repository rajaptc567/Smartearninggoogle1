/**
 * SmartExn Public SEO & Conversion Analytics Service
 * 
 * Privacy-Safe, Zero-PII Analytics Layer for Google Search Console,
 * Google Analytics 4 (GA4), and Organic Funnel Measurement.
 * 
 * CRITICAL SAFETY RULES:
 * - Never captures wallet balances, transaction IDs, or financial metrics.
 * - Never captures emails, phone numbers, passwords, or authentication tokens.
 * - Tracks only public SEO views, anonymous interactions, and navigation funnels.
 */

export type SeoCluster = 'worker' | 'advertiser' | 'trust' | 'knowledge' | 'legal' | 'general' | 'private';

export interface SeoEventPayload {
  event_category?: string;
  event_label?: string;
  page_location?: string;
  page_title?: string;
  seo_cluster?: SeoCluster;
  cta_name?: string;
  target_route?: string;
  placement?: string;
  search_term_length?: number;
  article_id?: string;
  question?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Classifies a route path into its primary public SEO authority cluster
 */
export function getSeoClusterFromPath(path: string): SeoCluster {
  if (!path) return 'general';
  const cleanPath = path.toLowerCase().split('?')[0].split('#')[0];

  if (
    cleanPath.startsWith('/member') ||
    cleanPath.startsWith('/admin') ||
    cleanPath.startsWith('/api') ||
    cleanPath === '/secure-admin-login56'
  ) {
    return 'private';
  }

  if (
    cleanPath.startsWith('/micro-tasks') ||
    cleanPath.startsWith('/paid-surveys') ||
    cleanPath.startsWith('/workers') ||
    cleanPath === '/how-it-works-for-workers' ||
    cleanPath === '/task-proof'
  ) {
    return 'worker';
  }

  if (
    cleanPath.startsWith('/advertise') ||
    cleanPath === '/campaigns' ||
    cleanPath === '/knowledge-base/how-to-create-a-campaign'
  ) {
    return 'advertiser';
  }

  if (
    cleanPath.startsWith('/trust-and-safety') ||
    cleanPath === '/faqs'
  ) {
    return 'trust';
  }

  if (
    cleanPath.startsWith('/knowledge-base') ||
    cleanPath === '/how-it-works'
  ) {
    return 'knowledge';
  }

  if (
    cleanPath === '/terms-of-use' ||
    cleanPath === '/privacy-policy' ||
    cleanPath === '/refund-policy'
  ) {
    return 'legal';
  }

  return 'general';
}

/**
 * Sanitizes a URL path to ensure no personal query parameters or hashes are sent
 */
export function sanitizePublicPath(pathname: string): string {
  if (!pathname) return '/';
  // Strip any query string or hash for privacy
  return pathname.split('?')[0].split('#')[0] || '/';
}

export const GA4_MEASUREMENT_ID = 'G-42724E1TLB';

/**
 * Core privacy-safe event dispatcher
 */
export function trackSeoEvent(eventName: string, payload: SeoEventPayload = {}): void {
  try {
    // 1. Never track private routes or sensitive actions
    if (payload.seo_cluster === 'private') {
      return;
    }

    // 2. Build sanitized payload with canonical domain context
    const cleanPath = payload.page_location?.startsWith('http') 
      ? payload.page_location 
      : `https://smartexn.com${payload.page_location || window.location.pathname}`;

    const cleanPayload: SeoEventPayload = {
      ...payload,
      page_location: cleanPath,
      timestamp: new Date().toISOString()
    };

    // 3. Dispatch to Google Tag / GA4 if available on window
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, cleanPayload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...cleanPayload
      });
    }

    // 4. Safe non-blocking execution in browser
  } catch (err) {
    // Fail silently in production without impacting user experience
  }
}

/**
 * High-level tracking helpers for the public SEO funnel
 */
export const seoAnalytics = {
  /**
   * Tracks a public SPA page view on route change
   */
  trackPageView: (pathname: string, title?: string): void => {
    const cleanPath = sanitizePublicPath(pathname);
    const cluster = getSeoClusterFromPath(cleanPath);

    if (cluster === 'private') return;

    const pageTitle = title || document.title || 'SmartExn';
    const pageLocation = `https://smartexn.com${cleanPath}`;

    // 1. Send standard GA4 page_view configuration update
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: pageLocation,
        page_path: cleanPath,
        send_to: GA4_MEASUREMENT_ID,
        seo_cluster: cluster
      });
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: 'page_view',
        page_title: pageTitle,
        page_location: pageLocation,
        page_path: cleanPath,
        seo_cluster: cluster
      });
    }
  },

  /**
   * Tracks a primary CTA button interaction (e.g. "Start Earning", "Launch Campaign")
   */
  trackCtaClick: (ctaName: string, targetRoute: string, placement = 'content_hero'): void => {
    const cluster = getSeoClusterFromPath(targetRoute);
    trackSeoEvent('seo_cta_click', {
      cta_name: ctaName,
      target_route: sanitizePublicPath(targetRoute),
      placement,
      seo_cluster: cluster
    });
  },

  /**
   * Tracks top navigation or footer link clicks
   */
  trackNavClick: (navLabel: string, targetRoute: string, navZone: 'header' | 'footer' | 'breadcrumb' = 'header'): void => {
    trackSeoEvent('public_nav_click', {
      event_label: navLabel,
      target_route: sanitizePublicPath(targetRoute),
      placement: navZone,
      seo_cluster: getSeoClusterFromPath(targetRoute)
    });
  },

  /**
   * Tracks user expanding an accordion FAQ item
   */
  trackFaqOpen: (question: string, pagePath: string): void => {
    trackSeoEvent('faq_open', {
      question: question.substring(0, 100),
      page_location: sanitizePublicPath(pagePath),
      seo_cluster: getSeoClusterFromPath(pagePath)
    });
  },

  /**
   * Tracks search input in the knowledge base (privacy-safe query length only)
   */
  trackKbSearch: (queryLength: number, resultsCount: number): void => {
    trackSeoEvent('knowledge_base_search', {
      search_term_length: queryLength,
      results_count: resultsCount,
      seo_cluster: 'knowledge'
    });
  },

  /**
   * Tracks clicking an educational article or guide card
   */
  trackArticleClick: (articleId: string, articleTitle: string, category: string): void => {
    trackSeoEvent('knowledge_base_article_click', {
      article_id: articleId,
      event_label: articleTitle,
      event_category: category,
      seo_cluster: 'knowledge'
    });
  },

  /**
   * Tracks conversion initiation toward worker onboarding
   */
  trackWorkerCtaClick: (ctaName: string, sourcePage: string): void => {
    trackSeoEvent('worker_cta_click', {
      cta_name: ctaName,
      page_location: sanitizePublicPath(sourcePage),
      seo_cluster: 'worker'
    });
  },

  /**
   * Tracks conversion initiation toward advertiser onboarding
   */
  trackAdvertiserCtaClick: (ctaName: string, sourcePage: string): void => {
    trackSeoEvent('advertiser_cta_click', {
      cta_name: ctaName,
      page_location: sanitizePublicPath(sourcePage),
      seo_cluster: 'advertiser'
    });
  },

  /**
   * Tracks when a user clicks the register CTA from a public landing page
   */
  trackRegisterCtaClick: (sourcePage: string, cluster?: SeoCluster): void => {
    trackSeoEvent('register_cta_click', {
      page_location: sanitizePublicPath(sourcePage),
      seo_cluster: cluster || getSeoClusterFromPath(sourcePage)
    });
  },

  /**
   * Tracks when a user clicks the login CTA from a public landing page
   */
  trackLoginCtaClick: (sourcePage: string, cluster?: SeoCluster): void => {
    trackSeoEvent('login_cta_click', {
      page_location: sanitizePublicPath(sourcePage),
      seo_cluster: cluster || getSeoClusterFromPath(sourcePage)
    });
  }
};
