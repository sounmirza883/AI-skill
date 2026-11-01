# UI and UX decisions that help or hurt SEO

Sources: web.dev, Chrome developer docs and Google Search Central, checked 2026-11-01. This file is the bridge to
`premium-ui-expert-v1`: that skill makes pages feel premium; this one keeps the same pages crawlable, fast and indexable.
When both skills apply, **SEO-safety wins over a visual effect** wherever they conflict.

## 1. Core Web Vitals (CWV)

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5 s | 2.5-4.0 s | > 4.0 s |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | 200-500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1-0.25 | > 0.25 |

- Judged at the **75th percentile** of real page loads, mobile and desktop separately; a page passes only if all three are Good. INP replaced FID in 2024. No official threshold or metric change has been announced for 2026 (ignore blog claims about a "2.0 s LCP threshold" or "CWV 2.0").
- **Field data** (CrUX, real users over 28 days; Search Console CWV report, PageSpeed Insights top section) decides; **lab data** (Lighthouse, one device and network) only helps debugging. Lab cannot measure INP (Total Blocking Time is the proxy).
- What Google says about ranking: core ranking systems reward good page experience and Google recommends good CWV, but it is "no single signal", it is not quantified, and relevant content can still rank with a weak page experience. HTTPS, mobile display, intrusive interstitials are listed as page-experience aspects to improve.
- Tools: PageSpeed Insights, `npx lighthouse <url> --view` (needs a recent Node), the `web-vitals` JavaScript library for your own real-user data, CrUX API and CrUX History API, Chrome DevTools Performance panel (shows field data and LCP breakdown), Search Console.

## 2. Fixes in priority order

### LCP (usually the hero image or the main headline)
1. Make the LCP element **discoverable in the first HTML**: a real `<img src>` (not a CSS background, not injected by JS). Add `fetchpriority="high"` to the LCP image only (one or two at most). Use `<link rel="preload" as="image" fetchpriority="high">` only if the image is referenced from CSS or JS. Put `fetchpriority="low"` on offscreen images that appear early (hidden carousel slides).
2. **Never `loading="lazy"` the LCP image.** Lazy-load everything below the fold.
3. Remove **render delay**: small or inlined critical CSS, no synchronous scripts in `<head>`, no hero hidden by JavaScript (`opacity:0` waiting for a script), no preloader that waits for `window.load`.
4. Cut **load duration**: AVIF or WebP with a JPEG fallback, `srcset`/`sizes`, correct pixel size, CDN with long immutable caching; fonts as WOFF2, subset, self-hosted or preconnected.
5. Cut **TTFB**: no redirect chains, CDN or edge cache, static or incremental rendering, Brotli/gzip; with streaming SSR keep the LCP element outside Suspense boundaries.
6. Keep pages **back/forward-cache eligible** (avoid `Cache-Control: no-store` on HTML).
Guideline split of LCP time: TTFB about 40%, resource load delay under 10%, resource load duration about 40%, render delay under 10%.

### INP (responsiveness)
1. Find slow interactions in **field data first**, then reproduce in DevTools. INP = input delay + processing + presentation delay.
2. Break up long tasks (`await scheduler.yield()`, with a `setTimeout(0)` fallback; Safari lacks `scheduler.yield`).
3. Keep event handlers light: paint first, defer analytics and saves; avoid layout thrashing.
4. Cut startup and hydration cost: ship less JavaScript, code-split, defer non-critical scripts, selective hydration or islands, Server Components for static UI.
5. Third-party scripts (consent managers, chat, tag managers): load on idle or on interaction and audit their long tasks.
6. Reduce rendering work: small DOM, `content-visibility: auto` on long offscreen sections.
7. Animation libraries: heavy scroll handlers, per-word text splitting, large Lottie or WebGL work block the main thread. Prefer CSS animations on `transform` and `opacity`.

### CLS (layout shift)
1. Images and video: `width`/`height` or CSS `aspect-ratio` (also on each `<source>` in `<picture>`).
2. Ads, embeds, iframes: reserve `min-height` or `aspect-ratio`.
3. Late-injected UI (cookie banners, promo bars): reserve the space or overlay it with `position: fixed`; never push content down after first paint.
4. Animate only **`transform` and `opacity`**; never `top`, `left`, `width`, `height`, `margin`.
5. Fonts: `font-display: optional`, or `swap` with a metric-matched fallback (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`); preload the critical WOFF2.
6. Skeleton screens must match the final size.

## 3. UI pattern → SEO risk → safe implementation

| Pattern | SEO risk | Implement it like this |
|---|---|---|
| **Hero reveal animation / text split into words** | Content hidden by script delays LCP; split text can fragment | Keep the real text in the server HTML. Animate with CSS on `transform` and `opacity`, no JS gate. Keep words in order; give the split heading an `aria-label`. Never fade the LCP element in from `display:none`. |
| **Preloader / splash screen** | Blocks first paint of real content; delays LCP | Avoid. If the brand needs one: CSS-only, under about 300 ms, not tied to `window.load`, real content already painted behind it. |
| **Skeleton screens** | Wrong size causes CLS; client-fetched content is missing from the HTML | Server-render real content; skeletons only for secondary widgets, sized to match. |
| **Sticky or shrinking header** | CLS if its height changes | Fixed height, or move with `transform`; reserve body padding. |
| **Cookie banner / popups** | Intrusive interstitials can hurt search performance; late banners cause CLS | Small banner or overlay that does not cover the main content, rendered in the first HTML or with reserved space; never a full-screen modal on landing from search; never hide content until consent. |
| **Newsletter / promo popup** | Classic interstitial risk | Small banner, or after real engagement, not on first view from search. |
| **Carousel / slider** | LCP delayed; JS-only slides missing | All slides in the DOM as real HTML; first slide `fetchpriority="high"`, others lazy with `fetchpriority="low"`; real `<a href>` links; no auto-advance on the LCP slide. |
| **Tabs and accordions** | Fine for Google if the text is in the HTML at load (mobile-first docs allow it). Whether hidden text is down-weighted is **unverified**; sources disagree. | All panel text in the first HTML; use `<details>` or buttons toggling `hidden`; never fetch panel content on click; keep the key answer visible by default. |
| **Infinite scroll / "Load more"** | Googlebot does not scroll or click | Real paginated URLs (`?page=2`) as `<a href>` links behind it; update the URL with the History API; each page self-canonical. |
| **Mega menu / deep navigation** | JS-built menus can be missed; very large menus dilute links | Render all nav links as `<a href>` in the server HTML; keep key pages a few clicks from home (no official number). |
| **Mobile hamburger menu** | Mobile DOM is what counts | Same links as desktop, present at load. |
| **Parallax / scroll-triggered reveal** | Content mounted only on scroll may never render | Content is in the DOM at load; IntersectionObserver only toggles classes, never injects content. |
| **Lazy-loaded content** | Content needing scroll or click events is not seen | Native `loading="lazy"` or IntersectionObserver for images; never lazy-load above the fold. |
| **JS-only links** (`onclick`, `<span>`, `href="#"`, `javascript:`) | Not crawled | `<a href="/real/path">` with descriptive anchor text; router links must render as `<a>`. |
| **Modals** | Content in click-opened modals is not seen | No indexable content in modals; deep-linkable views get their own URL. |
| **Client-side routing / hash routes (`#/orders`)** | Fragments are ignored: those "pages" cannot be indexed; unknown routes return 200 | History API with real paths; server returns real 404s; unique title, description and canonical per route. |
| **Web fonts, icon fonts** | Font swap shifts layout | See CLS; use SVG for icons. |
| **Dark mode** | No official effect | Same content in both modes; avoid a flash of the wrong theme. |
| **Video background** | Heavy; can become the LCP element | Use a `poster` image as the LCP image with `fetchpriority="high"`; start the video after load; headline stays real HTML. |
| **Accessibility** (headings, alt text, landmarks, contrast) | Google says heading order does not affect ranking; alt text is used for image understanding. An accessibility-to-ranking link is claimed, not proven. | Do it for users; claim only the documented SEO benefits. |

### Rules when using `premium-ui-expert-v1`
- Module 2 (hero reveal) and the `[data-hero]` fade: allowed, but the LCP element must not start at `opacity: 0` waiting for JavaScript. Keep headline text visible in the HTML and animate `transform` only, or start visible and animate a decorative layer.
- Module 1 (preloader): **skip for any page that must rank**. Use skeletons only for secondary widgets.
- Cursor tour, word rotator, bento build and similar showpieces: keep the real text in the HTML (`.sr-only` or visible), load their JavaScript with `defer`, and check INP and CLS afterwards.
- After any UI change, re-run Lighthouse and compare field data later; do not trade a pass on LCP for an animation.

## 4. Rendering strategy by framework

- **Marketing, content and product pages:** static generation, or SSR/ISR behind a CDN. **CSR-only SPAs** are the riskiest: shared title, no real 404s, content that depends on rendering.
- Next.js: `generateMetadata` / `metadata` (Server Components) with `metadataBase`; `app/sitemap.ts`, `app/robots.ts`; streaming metadata is on since v15.2; once streaming starts the HTTP status is already 200, so call `notFound()` **before** any slow `await` or Suspense boundary or the 404 becomes `noindex` on a 200 page. Nuxt: `useSeoMeta`, `useHead`. Astro: static by default, `@astrojs/sitemap`. SvelteKit: SSR default, `<svelte:head>`. Remix / React Router: a child `meta` export replaces the parent's.
- Prerendering services and "dynamic rendering" are Google's **workaround, not a long-term solution**.
- Fingerprint static asset file names (the renderer caches aggressively).

## 5. Verify what Googlebot sees (per template)

1. `curl -sA "<Googlebot UA>" -D - URL -o raw.html`: status, headers, canonical, title, H1, links, JSON-LD; size under 2 MB uncompressed (the 2 MB limit applies per file and includes headers).
2. Compare view-source with the rendered DOM; anything important that exists only after JavaScript is a risk.
3. URL Inspection → **Test live URL** → View tested page (rendered HTML, screenshot, blocked resources, console errors).
4. Rich Results Test for structured data in the rendered HTML.
5. DevTools with JavaScript disabled to see the no-JS page.
6. Search Console Crawl stats for response time and failures.
7. `node scripts/seo-audit.mjs <url>` for the raw-HTML checks (title, description, canonical, headings, schema, hash routes, thin raw HTML).

Googlebot facts: renders with a recent headless Chromium, stateless between requests, no clicks or scrolling, no WebSockets or permission prompts; no official "5 second" rendering limit exists (treat that as a myth).

## 6. Mobile-first indexing

- The mobile version is indexed. Mobile and desktop must match in primary content, headings, titles and descriptions, meta robots, structured data, image alt text and robots.txt rules; no blocked resources.
- Responsive design is recommended; avoid separate m-dot sites.
- Accordions and tabs on mobile are fine if the content is in the HTML; do not lazy-load primary content behind a swipe or click.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` is required.
- Body text about 16 px and tap targets about 44-48 px are good practice (not confirmed ranking factors).

## 7. Delivery and security

- HTTPS everywhere; HTTP → HTTPS with one 301/308. HSTS is good security practice (not an official SEO signal).
- Brotli or gzip; long cache lifetimes for fingerprinted assets.
- Use 503 for planned downtime; avoid long 5xx outages; real 404/410 for gone pages.
- Do not block Googlebot in a WAF or CDN bot rule by User-Agent alone; verify by reverse DNS or Google's IP lists, then allow.

## 8. Information architecture and URLs

- Descriptive, hyphenated, lowercase, stable URLs; no session IDs; no fragments for content; one version of each page.
- Group related pages, link them to each other, and make sure every page you want indexed has at least one crawlable `<a>` link.
- Visible breadcrumbs plus `BreadcrumbList` (desktop results only).
- Do not index internal search results or sort variants. Control facets (`technical-seo.md`).
- Keep important pages a few clicks from the home page (general practice; no official number).

## 9. Changes in 2025-2026 worth knowing

- INP is the responsiveness metric (since 2024). Lighthouse 13 (Oct 2025) replaced many audits with "insight" audits and removed several old ones; scoring unchanged. The CrUX Dashboard was retired (Nov 2025); use CrUX Vis, the CrUX API or BigQuery. CrUX added experimental CWV variants that include soft navigations (Oct 2026); stable scores are unchanged.
- Googlebot's 2 MB per-file limit is now explicitly documented (Feb 2026).
- Google's JavaScript SEO docs added notes on `noindex` handling, canonicalisation and non-200 rendering (Dec 2025).
