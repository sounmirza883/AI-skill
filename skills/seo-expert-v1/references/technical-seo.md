# Technical SEO: crawling, indexing, rendering

Facts below were checked against Google's own documentation on 2026-11-01. Google changes these pages often. Before relying
on a number or a "supported / not supported" claim, check the Search Central changelog (developers.google.com/search/updates)
for newer entries.

## 1. How Google gets from your server to a result

1. **Discover** a URL (links, sitemaps, redirects). 2. **Crawl** it (Googlebot fetches the HTML). 3. **Render** it (a headless
Chromium runs JavaScript). 4. **Index** it (decide whether and under which canonical URL to store it). 5. **Serve** it.
A page can fail at any step, and each failure looks different in Search Console (`search-console.md`).

| Fact | Detail |
|---|---|
| Fetch size limit | Googlebot reads the first **2 MB** of each supported file (HTML, and each CSS or JS file separately), counted uncompressed and including response headers. PDFs: 64 MB. Other Google crawlers default to 15 MB. Bytes past the cutoff are not fetched, rendered or indexed. |
| What to do about it | Keep HTML well under 2 MB. Put title, meta, canonical, hreflang, main content and key links early. Avoid huge inline base64 images, inline JSON and inline CSS. |
| Rendering | Headless Chromium, stateless (storage cleared between requests). No clicking, no scrolling, no permission prompts, no WebSockets/WebRTC. A "5 second rendering timeout" is a myth: no official number exists, but heavy or slow rendering still hurts. |
| Pages that are not 200 | May skip rendering. |
| Crawl budget | Matters only for very large sites (about 1M+ pages changing weekly, 10,000+ pages changing daily) or sites with many "Discovered - currently not indexed" URLs. Everyone else: keep a current sitemap and watch the Page indexing report. |
| What lowers crawl rate | Slow responses, 5xx, 429. What helps: fewer duplicate URLs, real 404/410 for removed pages, short redirect chains, fast TTFB, `304` support, accurate `lastmod`. `noindex` does not save crawl budget (the URL is still fetched). |
| Mobile-first | Google indexes the mobile version. Mobile and desktop must match in main content, titles, descriptions, meta robots, structured data, image alt text and robots.txt rules. Content inside tabs and accordions is fine if it is in the HTML at load. |
| Verify Googlebot | Reverse DNS must end in `googlebot.com`, `google.com` or `googleusercontent.com`, then a forward lookup must return the same IP; or match Google's published IP range JSON files. Never trust the User-Agent string alone. Allowlist verified ranges in your WAF and rate limiter. |

## 2. Which control do I use? (the most common source of mistakes)

| Goal | Use | Do NOT use |
|---|---|---|
| Keep a page out of search results | `noindex` (meta or `X-Robots-Tag`) on a page Google can crawl; or 404/410; or a password | robots.txt (a blocked URL can still be indexed from links, with no snippet) |
| Stop Google crawling a section (crawl traps, faceted filters) | `Disallow` in robots.txt | `noindex` (it still has to be fetched to be seen) |
| Merge duplicate URLs | 301 redirect, or `rel=canonical` | `noindex`, robots.txt, the Removals tool |
| Page is gone for good | 404 or 410 (treated the same) | 200 with an error message (soft 404); mass 301 to the home page (treated as soft 404) |
| Hide something from Search quickly | Search Console Removals (hides about 6 months) **plus** a permanent fix | Removals alone |
| Keep a staging site out | HTTP authentication, plus `noindex` | robots.txt as the only protection |
| Limit snippet or AI use of text | `nosnippet`, `max-snippet:N`, `data-nosnippet` (these also limit AI Overviews and AI Mode) | assuming robots.txt does it |

## 3. robots.txt

```
User-agent: *
Disallow: /cart
Disallow: /checkout
Disallow: /search
Allow: /

Sitemap: https://example.com/sitemap.xml
```

- Plain UTF-8 file at the root of **each** host and protocol (`https://example.com/robots.txt`); sub-folder files are ignored.
- Google reads up to **500 KiB**, caches it about 24 hours. Supported fields: `user-agent`, `allow`, `disallow`, `sitemap` (full URL).
  `crawl-delay` and `noindex:` lines are **not supported**. Wildcards `*` and `$` work; paths are case-sensitive; the longest matching rule wins.
- Status handling: 2xx parsed; 3xx followed up to 5 hops; 4xx (except 429) = no restrictions; **5xx = Google stops crawling the site for up to 12 hours, then uses the cached copy for up to 30 days**.
  Never use 401/403 to limit crawling.
- Frequent mistakes: `Disallow: /` shipped from staging; blocking CSS or JS (breaks rendering); blocking a page and expecting its `noindex` to work; typos in paths; blocking `/api/` that pages need to render.
- Allow or block AI crawlers deliberately, by name (see `ai-search-and-measurement.md`).

## 4. Meta robots and X-Robots-Tag

```html
<meta name="robots" content="noindex, follow">
<meta name="robots" content="max-snippet:160, max-image-preview:large">
```
```
X-Robots-Tag: noindex          # use for PDFs, images and other non-HTML files
X-Robots-Tag: googlebot: nosnippet
```

| Directive | Effect |
|---|---|
| `noindex` | Page is not shown in results. |
| `nofollow` | Links on the page are not followed (a hint). |
| `none` | `noindex, nofollow`. |
| `nosnippet` | No text snippet or video preview; also limits Search, Discover, AI Overviews and AI Mode use of the text. |
| `max-snippet:N` | At most N characters (`0` = nosnippet, `-1` = no limit). |
| `max-image-preview:none/standard/large` | Image preview size. `large` is needed for the big Discover-style thumbnails. |
| `max-video-preview:N` | Seconds (`0` = still image, `-1` = no limit). |
| `noimageindex`, `notranslate` | Self-explanatory. |
| `unavailable_after: <date>` | Drop the page after a date (RFC 822/850 or ISO 8601). |
| `indexifembedded` | Only valid together with `noindex`. |
| `data-nosnippet` (attribute on an element) | Exclude that element's text from snippets. Must be in valid static HTML, not added by JS. |

- Ignored by Google: `noarchive`, `nocache`, `nositelinkssearchbox`, meta keywords.
- If rules conflict, the most restrictive wins. Only `robots` and `googlebot` (and `googlebot-news`) meta names are honoured.
- The rule is read when the page is crawled, so a URL blocked in robots.txt never shows its `noindex`.
- **JavaScript pages:** do not ship `noindex` in the original HTML and then remove it with JS: Google may skip rendering and never see the change. If a page should be indexed, it must not contain `noindex` in the first HTML.

## 5. Sitemaps

- Formats: XML (normal), RSS, Atom, mRSS (video), plain text. Limit **50,000 URLs or 50 MB uncompressed per file**; a sitemap index can list up to 50,000 sitemaps (indexes cannot nest). News sitemap: 1,000 URLs.
- List only **canonical, indexable, 200-status URLs**, absolute, same host. No redirects, no `noindex`, no parameters you canonicalise away.
- Google **ignores `<priority>` and `<changefreq>`**. It uses `<lastmod>` only if it is consistently and verifiably accurate (a real content change, not a copyright-year edit or a rebuild date). A fake `lastmod` makes Google distrust the field: omit it unless you can maintain it.
- Submit in Search Console → Sitemaps, via the Sitemaps API, or with `Sitemap:` lines in robots.txt. It is a hint, not a command. The old `google.com/ping?sitemap=` endpoint was retired (returns 404): do not use it.
- Sites under about 500 pages may not need one, but it never hurts. Put it at the site root.
- Image, video and news extensions exist; hreflang can live in the sitemap:

```xml
<url>
  <loc>https://example.com/en/pricing</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/pricing"/>
  <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/preise"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/pricing"/>
</url>
```
(declare `xmlns:xhtml="http://www.w3.org/1999/xhtml"` on `<urlset>`; every variant lists all variants including itself.)

Generator: `scripts/sitemap-gen.mjs` (static sites or URL lists, splits above 50,000). Frameworks have built-ins: Next.js `app/sitemap.ts`, Astro `@astrojs/sitemap`, SvelteKit a `sitemap.xml/+server` route.

## 6. Canonicals, redirects, status codes

**Canonical (rel=canonical)**
- A strong **hint**, not a command. Signal strength: redirect (strong), `rel=canonical` (strong), sitemap listing (weak).
- One tag, in `<head>` of the HTML, absolute URL, **self-referencing** on indexable pages. Never point to a URL fragment. Do not mix HTML and HTTP-header canonicals with different values. Do not give different canonicals in sitemap, HTML and headers.
- If JavaScript sets it, it must match the HTML one; best to put it in the initial HTML.
- Never combine `canonical` with `noindex`. Do not canonicalise paginated pages to page 1. Do not canonicalise unrelated pages.
- HTTPS: no HTTP URLs in sitemaps, canonicals or hreflang.

**Redirects**
| Code | Use | Strength |
|---|---|---|
| 301 / 308 | Permanent move | Strong |
| 302 / 303 / 307 | Temporary | Weak (Google may keep the old URL indexed) |
- Googlebot follows up to **10 hops**; keep it to **one**. No meta-refresh or JS redirects for SEO moves. Keep redirects at least **1 year** after a move.

**Status codes**
| Code | Google's behaviour |
|---|---|
| 200 | Normal. A "not found" page that returns 200 is a **soft 404**. |
| 301/308 | Follow, transfer signals. |
| 404 / 410 | Content ignored; indexed URLs dropped over time. 410 is a slightly stronger "gone". |
| 401 / 403 | Treated like 4xx: not crawlable. Do not use to throttle. |
| 429 / 5xx | Crawl rate slows; URLs eventually dropped if errors persist. Use **503** for maintenance. |
- SPAs: unknown routes must return a real 404 from the server, or redirect to a URL that does, or the view must carry `noindex`.

## 7. URLs, duplicates, pagination, facets

- URLs: lowercase, hyphen-separated words, descriptive, stable, no session IDs, no fragments for content (`/#/page` is **not** crawlable; use real paths and the History API). Case matters (`/Apple` ≠ `/apple`). Pick one version of: HTTPS, www vs non-www, trailing slash; 301 everything else to it.
- Duplicate content is not a penalty, it wastes crawl and splits signals. Consolidate with 301 or canonical; link internally to the canonical.
- **Pagination:** `rel=next/prev` is not used by Google. Give each page a real `<a href>` URL (`?page=2` or `/page/2`), a **self-referencing canonical**, a unique title with the page number. Do not use fragments for page numbers. Infinite scroll needs paginated URLs behind it (Google does not scroll).
- **Faceted navigation / filters:** best: a crawlable unfiltered listing, filter parameters blocked in robots.txt (or `nofollow` links, consistent parameter order, `&` as separator); return 404 for empty combinations. Canonical to the unfiltered page is weaker. Do not `noindex` a section you also block.
- Internal search results and sort variants: `noindex` or block; never let them become crawl traps.

## 8. JavaScript and rendering strategy

| Page type | Recommended | Why |
|---|---|---|
| Marketing, content, product pages | SSG, or SSR/ISR behind a CDN | Metadata, links and status codes are in the first HTML |
| SPA only (client-side rendering) | Highest risk | Same title everywhere, no real 404s, content depends on rendering |
| Logged-in or personal pages | Not indexable anyway | `noindex`, do not waste effort |
- "Dynamic rendering" (different HTML for bots) is Google's **workaround, not a long-term solution**. Do SSR, static rendering or hydration.
- Links must be `<a href="/real/path">`. `onclick`, `<span href>`, `javascript:` and `href="#"` links are not reliably crawled. Hash routes (`#/orders`, `#!`) are ignored.
- Titles, descriptions, canonical and JSON-LD injected by JS do work, but put them in the initial HTML when you can. One canonical only.
- Use fingerprinted file names for JS and CSS (Google's renderer caches aggressively).
- Frameworks: Next.js `generateMetadata` / `metadata` (Server Components), `app/sitemap.ts`, `app/robots.ts`; call `notFound()` **before** any slow `await` or Suspense boundary or the 404 becomes a `200` with `noindex`. Nuxt `useSeoMeta`. Astro static by default. SvelteKit SSR by default with `<svelte:head>`. Remix/React Router: child `meta` replaces the parent's.

**See what Googlebot sees (do this for every template, not every page):**
1. `curl -sA "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" -D - URL -o raw.html` → status, headers, title, canonical, H1, links, JSON-LD in the raw HTML, size under 2 MB.
2. Compare view-source with the rendered DOM in DevTools: anything important that appears only after JS is a risk.
3. Search Console → URL Inspection → **Test live URL** → View tested page (rendered HTML, screenshot, blocked resources, console errors). The "Google Index" view shows what was actually indexed, which may be older.
4. Rich Results Test for structured data in the rendered HTML.
5. `node scripts/seo-audit.mjs <url>` for the raw-HTML checks.

## 9. International (hreflang) in short

- Use one method: `<link rel="alternate" hreflang>` in the head, HTTP header, or the sitemap.
- Every version lists **all** versions including itself (self-reference) and every link is reciprocal. Fully qualified URLs. ISO 639-1 language, optional ISO 3166-1 region (`en-GB`, not `en-UK`; no region-only codes; `zh-Hans`/`zh-Hant` allowed). `x-default` is the fallback.
- Each version has a self-referencing canonical in its own language. Do not auto-redirect users or Googlebot by IP or language.
- Translated pages are not duplicates. Details: `off-page-and-local-seo.md`.

## 10. Launch checklist

- [ ] No `noindex`, no `Disallow: /`, no password left over from staging (check meta, headers, robots.txt).
- [ ] One hostname and protocol: HTTP → HTTPS (one hop), www/non-www consolidated, trailing-slash rule consistent.
- [ ] Every indexable URL returns 200; real 404 for missing pages; no soft 404s.
- [ ] Unique title, description and one H1 per page; self-referencing canonical.
- [ ] robots.txt correct; `Sitemap:` line present; sitemap contains only canonical 200 URLs.
- [ ] Internal links are `<a href>`; no hash routes; every important page is linked from another page.
- [ ] Structured data valid and matching visible content; viewport tag; favicon.
- [ ] Mobile and desktop serve the same content and metadata; Core Web Vitals baseline measured.
- [ ] Search Console **Domain** property verified (DNS); sitemap submitted; Bing Webmaster Tools imported.
- [ ] Analytics installed; custom 404 page; redirects for old URLs tested.

## 11. Migration / site-move checklist (Google's guidance)

1. Build the old → new URL map from sitemaps, server logs, analytics, Search Console, CMS (include images, CSS, JS, PDFs).
2. One-to-one 301/308 redirects. No chains, no loops, no mass redirect to the home page.
3. On the new site: self-canonicals, hreflang, internal links and sitemap all use the **new** URLs; remove temporary `noindex`.
4. Test redirects on a sample of every URL pattern before launch.
5. Verify every property variant in Search Console. Use **Change of Address** only for domain or subdomain moves (not for HTTP → HTTPS, www changes or path changes).
6. Submit the new sitemap; keep the old sitemap for a while so Google finds the redirects, then remove it.
7. Keep redirects at least 1 year. Monitor Page indexing, Crawl stats and server logs daily at first. Expect temporary ranking movement; small and medium sites usually settle within weeks, large sites take longer.

## 12. Technical mistakes and Google's real stance

| Belief | Reality |
|---|---|
| robots.txt keeps pages out of Google | It blocks crawling only. Use `noindex`. |
| `noindex:` in robots.txt works | Not supported. |
| Canonical is a command | A strong hint that Google can override. |
| `priority` / `changefreq` help | Ignored. |
| Requesting indexing repeatedly speeds things up | No. It is not a guarantee and repeats do not help. |
| `crawl-delay` slows Googlebot | Ignored by Google. |
| Hidden or JS-loaded content is fine | Only if it is in the DOM without needing a click or scroll. |
| A 301 to the home page is a clean way to remove pages | Treated as a soft 404. Redirect to a close equivalent or return 404/410. |
