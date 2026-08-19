# SmartExn Google Search Console & GA4 Integration Guide (Phase P11)

**Production Domain:** `https://smartexn.com`  
**Security Level:** Enterprise / Zero-PII / Zero Financial Interference  
**Admin Portal Route:** `/admin/seo-intelligence` (Private Admin Guarded)  

---

## 1. Safety & Credential Boundary

Under no circumstances should Google OAuth Client Secrets or Service Account private key JSON files be committed to the client repository or exposed in the Vite frontend build.

### Integration Principles:
1. **Zero Client Secrets:** No private keys or service account credentials in React/Vite code.
2. **Honest Connection State:** When the Search Console API or GA4 tag is not actively supplying live stream data, the system displays `"Google Search Console is not connected."` instead of generating simulated or fake metrics.
3. **Strict Financial Isolation:** The SEO Intelligence layer runs completely isolated from all member wallets, balances, ledgers, deposits, withdrawals, tasks approval financial logic, and database schemas.

---

## 2. Google Search Console Setup & Verification

### Step 2.1: Domain Property Verification (DNS)
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Choose **Domain Property** verification for `smartexn.com`.
3. Add the TXT verification record provided by Google to your DNS provider (Cloudflare / Namecheap / Route 53).
4. Verify domain ownership.

### Step 2.2: Sitemap Submission
Submit the production sitemap URL:
- `https://smartexn.com/sitemap.xml`

Confirm that all **49 approved public canonical URLs** are recognized without errors.

---

## 3. Server-Side Google Search Console API Connection

To feed live query data into the Admin SEO Intelligence Dashboard (`/admin/seo-intelligence`):

### Step 3.1: Google Cloud Service Account
1. Open Google Cloud Console and select the project.
2. Enable the **Google Search Console API** (`webmasters.googleapis.com`).
3. Create a Service Account (e.g. `smartexn-gsc-reader@smartexn-prod.iam.gserviceaccount.com`).
4. In Google Search Console → Settings → Users & Permissions: Add the service account email with **Restricted / Read-Only** permissions.

### Step 3.2: Backend Proxy Architecture
The Node.js/Express backend server proxies Search Console API requests via server-side environment variables:

```http
POST /api/admin/seo/gsc-analytics
Authorization: Bearer <AdminToken>
Content-Type: application/json

{
  "startDate": "2026-07-20",
  "endDate": "2026-08-17",
  "dimensions": ["query", "page", "country", "device"],
  "rowLimit": 1000
}
```

The server calls `googleapis.webmasters('v3').searchanalytics.query` using the Service Account credentials and returns the real data to the admin screen.

---

## 4. Google Analytics 4 (GA4) Tag Configuration

SmartExn features a built-in privacy-safe public event dispatcher (`/services/seoAnalytics.ts`).

### Step 4.1: Production Tag Deployment
To activate GA4, add the official measurement snippet in `index.html` with your production Measurement ID:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    send_page_view: false // Managed dynamically by SeoAnalyticsTracker
  });
</script>
```

### Step 4.2: Public Event Matrix
The following 10 public conversion and navigation events are monitored without capturing any PII:

| Event Name | Parameters | Purpose |
| :--- | :--- | :--- |
| `page_view` | `page_location`, `page_title`, `seo_cluster` | Public SPA route view |
| `seo_cta_click` | `cta_name`, `target_route`, `placement`, `seo_cluster` | Public CTA interaction |
| `public_nav_click` | `event_label`, `target_route`, `placement`, `seo_cluster` | Header/footer/breadcrumb clicks |
| `faq_open` | `question`, `page_location`, `seo_cluster` | Accordion FAQ expansion |
| `knowledge_base_search` | `search_term_length`, `results_count` | Help center query count |
| `knowledge_base_article_click` | `article_id`, `event_label`, `event_category` | Guide card click |
| `worker_cta_click` | `cta_name`, `page_location`, `seo_cluster` | Worker funnel entry |
| `advertiser_cta_click` | `cta_name`, `page_location`, `seo_cluster` | Advertiser funnel entry |
| `register_cta_click` | `page_location`, `seo_cluster` | User registration initiation |
| `login_cta_click` | `page_location`, `seo_cluster` | Existing user return intent |

---

## 5. SEO Decision Engine & Striking-Distance Rules

Once live Search Console data streams into the system, the decision engine evaluates queries and pages against these heuristics:

1. **Striking Distance (Positions 5–20 with High Impressions):**
   - Candidate for internal linking from cluster hubs (`/micro-tasks`, `/how-it-works`, `/advertise`).
   - Deepen topical coverage with targeted FAQ entries.
2. **High Impressions + Low CTR:**
   - Candidate for snippet, title, and meta description rewriting.
   - Clarify the user value proposition without clickbait.
3. **High CTR + Low Impressions:**
   - Candidate for semantic expansion and related subtopic coverage.
4. **Excluded / Indexing Errors:**
   - Verify canonical parity and ensure no indexable route is disallowed in `robots.txt`.
5. **No Mass Programmatic Generation:**
   - Never auto-generate thin programmatic permutations. Every new page must serve distinct demand and offer unique value.
