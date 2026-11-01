# What an SEO agent must be able to do: capabilities, tools, workflows, safety

This answers "which skills should the SEO agent have?" In practice an SEO agent is **sixteen capabilities** working in a fixed order.
Each row says what the capability needs, which tool or API to use, and **how to prove it worked**. Data checked 2026-11-01; vendor
prices and quotas change, so re-check before promising a cost.

## 1. The capability map

| # | Capability | Inputs | Tool / API | How to verify |
|---|---|---|---|---|
| 1 | **Crawl and technical audit** | Start URL, scope, robots rules | `scripts/seo-audit.mjs` (URLs, sitemap), Screaming Frog (free to 500 URLs, licence for CLI), Crawlee, Scrapy, linkinator | Crawl count about equals sitemap plus Search Console known URLs; spot-check 10 URLs by hand |
| 2 | **Rendered-HTML check** | URL list | Playwright or Puppeteer, headless Chrome; Search Console URL Inspection live test | Diff raw HTML vs rendered DOM for title, canonical, H1, links, JSON-LD; confirm key content sits in the first 2 MB |
| 3 | **Indexability analysis** | Crawl plus Search Console | Status codes, meta robots, `X-Robots-Tag`, canonical, robots.txt, URL Inspection API | Cross-check "indexed" claims with URL Inspection `coverageState` |
| 4 | **Sitemap and robots.txt** | URL inventory (200, canonical, indexable only) | `scripts/sitemap-gen.mjs`, framework generators, Sitemaps API | Valid XML, ≤ 50,000 URLs and 50 MB per file, every URL returns 200, none `noindex`, robots.txt has a `Sitemap:` line |
| 5 | **Metadata at scale** | Page types, page data, SERP intent | LLM plus the templates in `metadata-and-structured-data.md` | Length and uniqueness lint, no duplicates, human review of a sample, no keyword stuffing |
| 6 | **Structured data** | Page type, visible content | JSON-LD templates, Schema Markup Validator, Rich Results Test (UI) | Markup matches visible content; the type still has a Google feature (FAQ and HowTo no longer do) |
| 7 | **Keyword research and clustering** | Seed topics, locale | Search Console queries (free), Keyword Planner, DataForSEO/Semrush/Ahrefs, Trends | Cluster by SERP overlap; record data source and date |
| 8 | **SERP analysis** | Query, location, device | Manual SERP review, DataForSEO SERP API, SerpApi | Record date, location and device; SERPs vary, never imply stability |
| 9 | **Content briefs** | Cluster, SERP features, first-party data | LLM plus the brief template | The brief names the original value added; no thin or duplicate pages |
| 10 | **Internal linking** | Crawl graph, page-to-query map | Script (orphans, click depth, anchor mining) | Links are contextual, anchors varied, targets indexable |
| 11 | **Image and Core Web Vitals diagnosis** | URL or origin | CrUX API and History API (field), PageSpeed Insights and Lighthouse (lab), Chrome DevTools MCP traces | Field data decides, lab data is diagnostic; CrUX needs enough traffic |
| 12 | **Search Console performance and indexing analysis** | Property access | `searchanalytics.query`, URL Inspection API, bulk export to BigQuery | Same windows before and after, page and query filters, `dataState=final` |
| 13 | **Backlink and off-page analysis** | Domain | Search Console Links report, Bing Webmaster Tools, Ahrefs/Semrush/Moz/DataForSEO | Compare two sources; flag provider coverage differences |
| 14 | **Local and international SEO** | Business profile, locale map | Business Profile (manual or API after approval), hreflang validator in the crawl | NAP consistency; hreflang return links and valid codes; LocalBusiness schema matches the profile |
| 15 | **Redirect mapping and migrations** | Old URL inventory, new URLs | Script, fuzzy matching, human review | Every old URL gives one 301/308 hop to a 200 and a relevant target; no chains or loops |
| 16 | **Reporting and measurement** | All of the above | Markdown/CSV, Search Console, GA4 | Every figure has source, date range and filter; estimates are labelled |
Plus on request: log-file analysis of Googlebot (verify IPs by reverse DNS or Google's IP lists, never by user-agent alone), competitor analysis (label third-party traffic as modelled), AI-search visibility checks (`ai-search-and-measurement.md`).

## 2. Tools and APIs (auth, limits, cost)

| Tool | Auth | Limits | Cost | Agent can call it from a terminal? |
|---|---|---|---|---|
| Search Console Search Analytics | OAuth, or a service account added as property user | up to 25,000 rows per request, paginate; 1,200 queries/min per site; `dataState` final/all/hourly_all | Free | Yes, after one-time credential setup |
| URL Inspection API | same | **2,000/day, 600/min per site**; indexed version only | Free | Yes |
| Sitemaps API | same | normal API limits | Free | Yes (writes need user approval) |
| Search Console bulk export (BigQuery) | UI setup, GCP IAM | daily export, no 50,000 cap | BigQuery costs | Via `bq` |
| Indexing API | service account | **only `JobPosting` and livestream pages**; default 200/day | Free | Yes, but never for ordinary pages |
| PageSpeed Insights API v5 | API key (optional) | about 25,000/day (UNVERIFIED) | Free | Yes (`curl`) |
| CrUX API / History API | API key | 150 queries/min per project, free | Free | Yes |
| Lighthouse CLI | none | needs local Chrome and a recent Node | Free | Yes |
| Rich Results Test / Schema Markup Validator | none | no public API | Free | No (ask the user or drive the UI only if permitted) |
| Bing Webmaster API / IndexNow | API key / key file on your site | IndexNow: 10,000 URLs per POST | Free | Yes |
| GA4 Data API | OAuth or service account | 200,000 tokens/day on standard properties | Free | Yes |
| Business Profile APIs | OAuth, **approved project** | 0 until approved; verified profile 60+ days | Free | After approval |
| Screaming Frog, Sitebulb | licence | free tier 500 URLs | about £199/year (prices conflict) | Paid CLI only |
| Crawlee, Scrapy, linkinator, Playwright, Puppeteer | none | your own politeness settings | Free | Yes |
| DataForSEO | basic auth | pay as you go, $50 minimum top-up; SERP from about $0.0006 per search | Per use | Yes. Best cost for agents |
| Ahrefs API v3 | API key | plan units (e.g. 200k units/month on the lowest API plan) | Subscription | Yes |
| Semrush API | API key | Business-tier plan plus purchased units | Subscription | Yes |
| Moz API v3 | access ID and secret | small free allowance | Free/paid | Yes |
| SerpApi | API key | paid tiers | Paid | Yes, in a terms-of-service grey area; check first |
Not to build on: the Custom Search JSON API (closed to new customers, ends 2027). Google Trends has an alpha API (application only).
Worth paying for: DataForSEO when you need SERPs, keyword metrics or on-page crawls without a subscription; Ahrefs or Semrush only if the user already has them (backlink data is their unique value). Free tools (Search Console, CrUX, PSI, Lighthouse, GA4, IndexNow) cover most audits.

**Works without a browser login:** CrUX, PSI, Lighthouse, IndexNow, DataForSEO, Moz, SerpApi, crawlers, Playwright. **Needs OAuth or a service account:** Search Console, GA4, Business Profile, BigQuery. **Needs a human:** Rich Results Test, Schema Markup Validator, Search Console UI-only reports (such as the Generative AI report), Business Profile approval and verification.

## 3. MCP servers and integrations (2026)

| Server | What it gives | Notes |
|---|---|---|
| Google Analytics MCP (official, experimental) | run_report, realtime, funnel, property details | Read-only by default; auth via application-default credentials |
| `mcp-gsc` (community) | Search analytics, period comparison, URL inspection, sitemaps | Destructive tools off unless explicitly enabled; but sitemap management can submit or delete |
| DataForSEO MCP | docs search, generic `api_request` | Login/password in env vars |
| Ahrefs, Semrush hosted MCP | Their data through OAuth | Plan eligibility conflicts across sources: check first |
| Chrome DevTools MCP | Performance traces, CrUX hints | Good for CWV diagnosis |
Prefer a plain HTTP or CLI call for single requests; use MCP for multi-step Search Console or GA4 work where OAuth is already configured.

## 4. How a professional engagement is structured (use as the agent's workflow)

1. **Discovery**: goals, revenue pages, markets and languages, CMS and stack, access to Search Console / GA4 / logs, past migrations or penalties, brand terms, competitors, constraints.
2. **Technical audit** → 3. **content audit** → 4. **keyword research and URL mapping** → 5. **on-page** → 6. **internal linking** → 7. **off-page plan** → 8. **reporting**.
Deliverables: prioritised issue backlog (URL, evidence, fix, owner, impact, effort), keyword map, redirect map, metadata sheet, schema spec, briefs, link plan, dashboard, monthly report.

**Prioritisation:** score each item with ICE (Impact, Confidence, Ease, 1-10 each) or RICE (Reach × Impact × Confidence ÷ Effort). Hard rule: anything blocking crawling or indexing of revenue pages is **P0 regardless of score**. Reach = clicks or impressions of the affected pages from Search Console.

**30 / 60 / 90 days**
- Days 0-30: access and baselines (Search Console 16 months, GA4, logs); crawl; fix P0 (indexability, 5xx, robots, canonicals, redirects); clean the sitemap; metadata for the top 50 pages; Core Web Vitals diagnosis; keyword map.
- Days 31-60: on-page rewrites for striking-distance queries (positions 8-20); schema where a feature still exists; internal-link pass (orphans, hubs); 2-4 briefs; local profile clean-up.
- Days 61-90: new or consolidated content; link-earning plan; hreflang if needed; measure first changes page-by-page; retrospective and next-quarter plan.

Launch and migration checklists: `technical-seo.md` sections 10 and 11.

## 5. Safety rules (non-negotiable)

**Never:** cloaking; hidden text or links; doorway pages; scaled low-value page generation (including AI-written and "fan-out" pages); keyword stuffing; expired-domain or site-reputation abuse; sneaky redirects; back-button hijacking; buying or selling links that pass ranking credit; fake or undisclosed-incentivised reviews; user-generated spam; automated scraping of Google result pages (Google lists "machine-generated traffic" as a spam policy); bulk "request indexing" or Indexing API use for pages that are not eligible; FAQ/HowTo markup created only for rich results.

**Credentials:** read-only scopes by default; application-default credentials or a service account with restricted access; keys in environment variables or a secrets file outside the repo; never print, log or commit them; never ask the user to paste tokens into chat. Get explicit confirmation before any **write** action (submitting or deleting sitemaps, removals, GA4 annotations, Search Console deletes).

**Crawling politely:** read robots.txt; identify yourself with a custom User-Agent; 1-2 requests per second; honour 429/503 and `Retry-After`; crawl only sites the user owns or may test; avoid logged-in and checkout paths; cap the page count.

**Honesty:** no ranking or traffic guarantees; label estimates (third-party volumes, competitor traffic) as modelled; state sample size, date range and filters; mark anything unverified; say when Search Console data is sampled or top-rows only.

## 6. Proving an SEO change worked

- **Before:** export a baseline (same page set, 28+ days, `dataState=final`) and write the change date in a Search Console custom annotation and in a changelog.
- **After:** compare equal-length windows aligned by weekday, filtered by page and by non-branded queries (Branded queries filter), split by device and country. Judge clicks and CTR per page group, not only average position.
- **Lag:** recrawl takes days to weeks; content and link effects usually take weeks to months (Google publishes no figure).
- **Controlled tests** (templated sites with enough traffic): split similar pages into variant and control groups at the same time, balance them before launch, estimate the effect with a time-series method (difference-in-differences or CausalImpact). Otherwise treat before/after as indicative.
- **False conclusions to flag:** seasonality; core or spam updates inside the window; the September 2025 `&num=100` change that cut impressions and improved average position; Search Console data lag; rank trackers differing by location and personalisation; changing many things at once; branded demand growth mistaken for an SEO win; regression to the mean after picking pages that just dropped.
