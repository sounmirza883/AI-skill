# Google Search Console and Bing Webmaster Tools

Search Console (GSC) is Google's free dashboard and the only first-party source of truth for **how Google sees your site**.
Everything here was checked against Google's documentation on 2026-11-01; GSC changes often, so if a button or report is
missing, check the Search Console release notes and Google's Search Central blog.

## 1. Set up (first hour)

1. **Add a Domain property** (`example.com`). It covers every protocol and subdomain. Verification is **DNS only** (a TXT or CNAME record). Ask the user to add it, or do it if you have DNS access.
   If DNS is impossible, add a **URL-prefix** property (`https://www.example.com/`) and verify by HTML file, meta tag, Google Analytics or Tag Manager.
2. Keep the verification record or file in place forever; add a second method as backup.
3. Add everyone who needs access (Settings → Users and permissions). Use the lowest role that works (Restricted for read-only).
4. **Submit the sitemap** (Indexing → Sitemaps → enter `sitemap.xml` → Submit). Also keep the `Sitemap:` line in robots.txt. Status should become **Success**; "Couldn't fetch" or "Has errors" means fix the file or the URL.
5. In **URL Inspection**, test the home page and one page of each template (product, article, category): confirm "URL is on Google" or request indexing for key new pages.
6. Create a **Bing Webmaster Tools** account and import the site from Search Console (one click); submit the sitemap there too.
7. Note the date: record launch dates and big changes as **custom annotations** (Performance report) so later comparisons are honest.

Never ask the user to paste tokens, passwords or verification secrets into chat. Walk them through the clicks instead.

## 2. Sitemaps report

- Lists only sitemaps submitted through the report or the API. "Remove sitemap" only hides it from the report; Google may still use it.
- Compare "Discovered URLs" with your real number of indexable pages. A big gap means the sitemap is wrong or Google is dropping URLs.
- An accurate `lastmod` is the recommended way to get many changed pages recrawled; "Request indexing" is for a handful of URLs.

## 3. URL Inspection

| Part | What it tells you |
|---|---|
| **Google Index view** | The version Google last indexed: status, canonical Google chose (and yours), last crawl, referring sitemap, mobile usability, structured data found. |
| **Test live URL** | Fetches the page now: rendered HTML, screenshot, blocked resources, console errors, HTTP response. Passing does not guarantee indexing, and it does not check manual actions, removals or sitemaps. |
| **Request indexing** | Runs a quick live check and queues the URL; refused if not indexable. Usually about a day, can take longer, **no guarantee**. There is a daily per-property quota (exact number not published). For many URLs use a sitemap instead. |
- Use it to answer: Is it indexed? Which canonical did Google pick? Can Google render the content? Is it blocked?

## 4. Page indexing report: every status and the fix

Open Indexing → Pages. "Why pages aren't indexed" lists the reasons; click one, then a URL, then URL Inspection.

| Status | Meaning | What to do |
|---|---|---|
| Server error (5xx) | Server returned 5xx | Fix the server or hosting; check uptime and WAF rules; test with a Googlebot-like request. |
| Redirect error | Chain too long, loop, bad or over-long URL | One hop only, remove loops, fix empty or malformed targets. |
| Blocked by robots.txt | A rule blocks crawling | If the page should be indexed: remove the rule. If it should stay out: unblock it and add `noindex` instead. |
| Excluded by 'noindex' tag | `noindex` found (meta or header) | Remove it if you want the page indexed (and check templates and plugins that add it). |
| Soft 404 | A 2xx page that looks empty or like "not found" | Return a real 404/410, or add real content. |
| Blocked due to unauthorized request (401) / access forbidden (403) / other 4xx | Googlebot cannot access the page | Remove the login requirement, or allow verified Googlebot. Do not use 401/403 to limit crawling. |
| Not found (404) | Page returned 404 | Nothing, if you removed it on purpose. If it moved, 301 to the new URL. |
| **Crawled - currently not indexed** | Crawled but Google chose not to index it | Quality problem more often than technical: improve uniqueness, depth and intent match, add internal links from strong pages, merge or remove near-duplicates. No resubmission needed; it can be indexed later. |
| **Discovered - currently not indexed** | Known URL, not yet crawled (Google expected crawling to overload the site) | Improve server speed and capacity, internal linking and sitemap `lastmod`; remove junk URLs that eat attention. |
| Alternate page with proper canonical tag | Correctly points to another indexed page | Nothing. This is normal. |
| Duplicate without user-selected canonical | A duplicate and you declared no canonical | Add a self-referencing canonical on the page you want, or make the content distinct. |
| Duplicate, Google chose different canonical than user | Google overrode your canonical | Compare the pages in URL Inspection; make the content clearly different or point your signals (links, sitemap, redirects) consistently at one URL. |
| Page with redirect | The URL redirects | Check the target; remove the old URL from the sitemap and internal links. |
| Indexed, though blocked by robots.txt (warning) | Indexed from links without being crawled | If it should be out: unblock and add `noindex`. Otherwise accept the limited snippet. |
| Page indexed without content (warning) | Google could not read the content | Check cloaking, unsupported formats, rendering errors; use the live test. |

Triage order: 5xx and robots blocks first, then `noindex` mistakes, then soft 404s and redirects, then canonical conflicts, then "crawled/discovered - not indexed" (quality work).
A **sample** of URLs per status is enough to find the pattern; fix the template, not each page.

## 5. Performance report (queries, clicks, impressions, CTR, position)

- Dimensions: Queries, Pages, Countries, Devices, Search appearance, Dates. Search types: Web, Web (multimodal, new in 2026), Image, Video, News. Views: hourly (last 24 h), daily, weekly and monthly (added Dec 2025). Default range is 3 months; history is about 16 months, so **export baselines early**. Anonymised queries are excluded from rows; the newest days are preliminary.
- AI Mode traffic has been counted in the Web totals since June 2025. A separate **Generative AI performance report** (impressions) rolled out in 2026; it appears to be UI-only, so export it manually (UNVERIFIED for API access).
- Use the **Branded queries filter** (added Nov 2025) to separate brand demand from real SEO growth.

**Recipes**
| Goal | How |
|---|---|
| Striking distance wins | Filter Queries with average position 8-20 and high impressions → improve the matching page (title, intro, depth, internal links). Often the quickest legitimate gain. |
| Low CTR | Pages with top-5 positions but low CTR compared with similar queries → rewrite title and description; check whether a SERP feature or AI answer is taking clicks. |
| Cannibalisation | Filter one query, open the Pages tab: two or more URLs with the same intent trading places → merge (301), differentiate, or fix internal links. Several pages ranking for one query is not automatically a problem. |
| New content check | Filter by the page URL, compare equal-length periods aligned by weekday. |
| Seasonality / noise | Compare to the same weeks last year; ignore the days around confirmed Google updates. |
| Before / after a change | Same page group, same length windows, `final` data only, note the annotation date; wait **at least 1-2 weeks, usually several**. Judge clicks and CTR per page group, not average position alone. |
- The September 2025 loss of `&num=100` made many sites see fewer impressions and a better average position: treat that as a measurement artefact when comparing across that date.

## 6. Other reports

| Report | Use |
|---|---|
| Core Web Vitals | CrUX field data grouped by similar URLs; a group's status is its worst metric (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile). Falls back to origin data when a group has too little traffic. See `ui-ux-for-seo.md`. |
| HTTPS | Which URLs are not HTTPS. |
| Enhancements (Breadcrumbs, Products, Videos…) | Validates structured data on your pages; fix errors, then "Validate fix". Reports for removed types (FAQ, HowTo) are going away. |
| Links | Top linked pages, top linking sites, top anchor text. A **sample**, 1,000 rows on screen, exports up to 100,000; may include removed links; does not show nofollow. |
| Crawl stats (root properties only) | Host status (robots.txt, DNS, connectivity), response codes, file types, average response time, discovery vs refresh. Mostly useful for sites over about 1,000 pages or during incidents. |
| Removals | Temporary hide (about 6 months) and "clear cached snippet". Permanent removal needs 404/410, a password or `noindex`. |
| Manual actions | If any: fix **all** affected pages, then Request Review with a clear explanation of what was wrong and what you changed; takes days to weeks. New types include "back button hijacking". |
| Security issues | Hacked content or malware: clean the site, then request review. |
| Settings → Change of Address | Only for domain or subdomain moves. |

## 7. Automation: APIs and bulk export (for agents)

| API | Limits | Notes |
|---|---|---|
| Search Analytics `searchanalytics.query` | rowLimit up to 25,000 per request (paginate with `startRow`; about 50,000 rows per day per search type is the cap reported, UNVERIFIED on the limits page); 1,200 queries/minute per site; `dataState`: `final`, `all`, `hourly_all` | Hourly data in the API since April 2025. Rows are the top rows by clicks, not guaranteed complete. |
| URL Inspection API | **2,000 per day and 600 per minute per site** | Indexed version only. No live test, no "request indexing". |
| Sitemaps API | list, get, submit, delete | Treat submit/delete as write actions. |
| Bulk export to BigQuery | Daily table, all rows except anonymised queries, no 50,000 cap | Must be set up in the UI first; no backfill before enabling (UNVERIFIED). |
| Indexing API | Only pages with `JobPosting` structured data or livestream `BroadcastEvent` | **Never use it for ordinary pages.** |

- Auth: OAuth for a person, or a service account added as a user of the property. Use read-only scopes by default. Keep keys in environment variables or a secrets file outside the repo; never print or commit them. Ask the user before any write action (submitting or deleting sitemaps, removals).
- MCP servers exist (for example the community `mcp-gsc`); prefer plain API calls for single requests and MCP only when OAuth is already configured.

## 8. Bing Webmaster Tools and IndexNow

- Import from Search Console, submit the sitemap, check Index Explorer and the **AI Performance** report (citations in Copilot and Bing AI summaries; preview since Feb 2026, UI only as of last check).
- **IndexNow** is an open protocol: host `https://example.com/<key>.txt` containing the key (8-128 characters), then `POST https://api.indexnow.org/indexnow` with `{"host","key","keyLocation","urlList":[...]}` (up to 10,000 URLs). Replies: 200/202 accepted, 403 bad key, 422 invalid URLs, 429 too often. Participating engines share the ping. Google does **not** use IndexNow (UNVERIFIED on the pages checked) , so keep Google's own sitemap process.

## 9. How long things take (be honest with the user)

| Event | Realistic range |
|---|---|
| Google discovers a new URL from a link or sitemap | Hours to a few days (about a day is typical) |
| Indexed | Anywhere from minutes to weeks; low-quality pages may never be indexed |
| Title / snippet update after a recrawl | Days |
| Canonical change taking effect | 1-3 weeks |
| New content reaching stable rankings | Weeks to months; competitive terms months |
| Site move settling | Weeks to 1-3 months |
| Recovery after a core update | Months, often needs the next update; Google gives no guarantee |
| Recovery after a spam update or manual action fix | Days to weeks to months |
Numbers are from Google documentation and talks where available and from reputable secondary reports otherwise; Google publishes no guarantees.

## 10. Weekly routine for an agent with GSC access

1. Page indexing: new errors or sudden growth in any status → open a sample, find the template cause.
2. Sitemaps: still Success, discovered count sensible.
3. Performance: top pages and queries vs previous period (aligned weeks); striking-distance list; low-CTR list.
4. Core Web Vitals: any group moved from Good to Needs improvement.
5. Manual actions and Security: should be empty.
6. Write down what changed on the site this week next to the numbers, so cause and effect stay honest.
