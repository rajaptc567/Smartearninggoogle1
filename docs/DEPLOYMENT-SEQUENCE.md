# SmartExn Production Deployment Sequence & Post-Launch Protocols (Phase P12)

This document outlines the required step-by-step procedure for deploying SmartExn to production and launching the Work & Earn ecosystem.

---

## 1. 12-Step Production Launch Sequence

### Step 1: Complete Phase P12 QA (Pre-Production)
- Confirm all local functional and lint audits pass.
- Verify that Work & Earn is the primary public entry and Investment is the secondary product.
- Verify provider abstraction readiness and honest disconnected status messages.

### Step 2: Owner Reviews Final Report
- Platform owner conducts complete visual and functional smoke testing in the staging environment.
- Approve pre-push checklist (`/docs/GITHUB-PRE-PUSH-CHECKLIST.md`).

### Step 3: Owner Commits and Pushes Project to GitHub
- Initialize or sync the repository with the main branch.
- Push clean, verified codebase to the production GitHub repository.

### Step 4: Configure Production Deployment Pipeline
- Connect GitHub repository to production hosting (e.g. Google Cloud Run / Vercel / AWS / Docker container).
- Set runtime production environment variables (Node environment, secure database connection strings).

### Step 5: Verify Production URL
- Confirm SSL/TLS certificate validity (`https://smartexn.com`).
- Verify domain routing, asset caching headers, and SPA fallback rewrites.

### Step 6: Verify Public Work & Earn Experience
- Execute live route smoke tests on homepage, `/micro-tasks`, `/paid-surveys`, `/how-it-works`, `/advertise`, and `/trust-and-safety`.
- Validate registration and login routing into the Work & Earn Dashboard.

### Step 7: Configure Google Search Console
- Verify production domain property via DNS TXT record.
- Confirm ownership in Google Search Console console.

### Step 8: Submit Production Sitemap
- Submit `https://smartexn.com/sitemap.xml` directly to Google Search Console.
- Confirm all production-ready canonical URLs are discovered without indexation blockers.

### Step 9: Configure Official GA4 Measurement ID
- Inject official Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`) into production environment configuration.
- Verify that the privacy-safe event dispatcher is active.

### Step 10: Verify Real Analytics
- Confirm real-time user session tracking in Google Analytics dashboard.
- Verify that no PII or member wallet data enters analytics events.

### Step 11: Verify External Provider Integrations
- Once official partnership agreements and Publisher IDs are obtained (TimeWall, CPX Research, Lootably, BitLabs):
  - Configure secure backend server postback webhook handlers.
  - Set production credentials in server environment variables.
  - Toggle provider status in the Provider Abstraction Layer from `pending_integration` to `active`.

### Step 12: Begin Real SEO Monitoring
- Monitor Google Search Console performance reports weekly for real impressions, clicks, CTR, and search queries.
- Use the Private Admin SEO Intelligence Dashboard (`/admin/seo-intelligence`) to track indexation health and striking-distance opportunities.

---

## 2. The First 30-Day SEO Rule

During the initial 30 days post-launch:

1. **Zero Mass Programmatic Generation:** Do NOT generate dozens or hundreds of programmatic derivative pages.
2. **Collect Real SERP Signals:** Allow search engine crawlers to discover, render, and evaluate the 49 canonical authority pages.
3. **Analyze Real Metrics:** Base all future content additions on actual Google Search Console queries, search impressions, and user conversion patterns.
4. **Iterate on Evidence:** Use the structured methodology in `/docs/SEO-CHANGELOG.md` to conduct controlled, measurable title and meta tag experiments.
