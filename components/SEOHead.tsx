import React, { useEffect } from 'react';

export interface AlternateLocale {
  lang: string;
  url: string;
}

export interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  canonicalUrl?: string;
  robots?: string;
  ogType?: string;
  ogImage?: string;
  ogLocale?: string;
  lang?: string;
  alternateLocales?: AlternateLocale[];
  schemaJson?: object | object[];
  schema?: object | object[];
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'SmartExn | Online Micro-Tasks, Surveys & Global Gigs',
  description = 'Complete online micro-tasks, surveys and gigs on SmartExn, submit proof and earn rewards when approved. Businesses can create campaigns and reach a global task-based workforce.',
  canonical,
  canonicalUrl,
  robots = 'index, follow',
  ogType = 'website',
  ogImage = 'https://smartexn.com/favicon.svg',
  ogLocale = 'en_US',
  lang = 'en',
  alternateLocales,
  schemaJson,
  schema
}) => {
  const effectiveCanonical = canonical !== undefined ? canonical : (canonicalUrl || (robots.includes('noindex') ? '' : 'https://smartexn.com/'));
  const effectiveSchema = schemaJson || schema;

  useEffect(() => {
    // 1. Update Document Title and HTML Lang
    document.title = title;
    if (document.documentElement) {
      document.documentElement.lang = lang;
    }

    // Helper to update or create meta tags
    const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    setMetaTag('meta[name="description"]', 'name', 'description', description);
    setMetaTag('meta[name="robots"]', 'name', 'robots', robots);

    // 3. Open Graph Meta Tags
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', effectiveCanonical);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'SmartExn');
    setMetaTag('meta[property="og:locale"]', 'property', 'og:locale', ogLocale);

    // 4. Twitter Card Meta Tags
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', '@SmartExn');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (effectiveCanonical) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', effectiveCanonical);
    } else if (canonicalLink) {
      canonicalLink.remove();
    }

    // 6. Alternate Hreflang links if provided (localization-ready)
    const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingHreflangs.forEach((el) => el.remove());

    if (alternateLocales && alternateLocales.length > 0) {
      alternateLocales.forEach((alt) => {
        const link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', alt.lang);
        link.setAttribute('href', alt.url);
        document.head.appendChild(link);
      });
    }

    // 7. Dynamic JSON-LD Schema
    const scriptId = 'dynamic-seo-jsonld';
    let existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (effectiveSchema) {
      if (!existingScript) {
        existingScript = document.createElement('script');
        existingScript.id = scriptId;
        existingScript.type = 'application/ld+json';
        document.head.appendChild(existingScript);
      }
      existingScript.text = JSON.stringify(effectiveSchema);
    } else if (existingScript) {
      existingScript.remove();
    }

    return () => {
      // Optional cleanup on unmount
    };
  }, [title, description, effectiveCanonical, robots, ogType, ogImage, ogLocale, lang, alternateLocales, effectiveSchema]);

  return null;
};

export default SEOHead;
