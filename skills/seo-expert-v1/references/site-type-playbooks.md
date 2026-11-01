# Site-type playbooks: which pages and metadata each kind of site needs

Use after the interview tells you the site type. For each type: page inventory (with the metadata each needs), schema, the biggest
risks, quick wins, and what not to do. Metadata details live in `metadata-and-structured-data.md`.

## 1. Web app or SPA with a marketing front (this is the most common SEO failure)

**Examples:** SaaS dashboards, shops built as a client-side single-page app, portals.
- **Indexable pages must be real URLs**: `/`, `/pricing`, `/features`, `/blog/...`, `/products/...`. Routes such as `#/orders` or `#!/shop` are **not crawlable**; switch to History API paths and server-side or static rendering for public pages.
- Logged-in, cart, checkout, account and thank-you pages: `noindex` (crawlable, with real authentication), never indexed.
- Every public route needs its own `<title>`, description, canonical, H1 and real `<a href>` links; unknown routes return a **real 404**.
- Content must be in the first HTML (SSR/SSG) or reliably rendered; test with URL Inspection live test.
- Quick wins: server-render the home and pricing pages, add robots.txt and sitemap, unique titles per route, Organization + WebSite schema.
- Don't: ship one title for the whole app; hide marketing copy behind a client-side fetch; rely on dynamic rendering long-term.
- **The demo shop in this repo is exactly this case** (hash routes, one static title, no sitemap, no robots.txt): it is a good first test of this skill.

## 2. E-commerce

**Page inventory:** home · category and subcategory listings · product pages (variants) · brand pages · buying guides and blog · about, contact, shipping and returns, FAQ · cart, checkout, account (`noindex`) · search results (`noindex`) · 404.
- **Metadata:** unique title and description per category and product (templates with real attributes: brand, material, size, price); self-canonicals; variant canonicals; `Product` + `Offer` + `BreadcrumbList`; shipping and return policy markup once at Organization level; `AggregateRating` only with real reviews shown on the page.
- **Categories are the main targets** for commercial queries: unique intro text, subcategory links, a buying guide; do not leave them as bare grids.
- **Facets and filters:** block parameter combinations in robots.txt and keep a crawlable unfiltered listing; consistent parameter order; 404 for empty combinations. Pagination: unique `<a href>` URLs, self-canonical, no canonical to page 1.
- **Product lifecycle:** temporarily out of stock → keep the page, `availability: OutOfStock`, offer notify-me and alternatives; permanently gone → 301 to the closest replacement, else 404/410; seasonal pages → keep one permanent URL and update it yearly.
- **Merchant Center free listings:** feed with `id`, `title`, `link`, `image_link`, `price`, `description`, `availability` (plus brand, GTIN/MPN, condition; apparel needs colour, size, gender, age group, `item_group_id`); set shipping and return policies; consistent with on-page data.
- **Content:** rewrite manufacturer descriptions with original specs, sizing, use cases and photos; collect genuine reviews (no gating, no incentives without disclosure).
- Don't: index every filter combination; duplicate manufacturer text across thousands of pages; show a price in markup that differs from the page; fake urgency or scarcity.

## 3. SaaS and B2B

**Inventory:** home · product and feature pages · use-case and industry pages · pricing · integrations (one real page per integration with unique content) · comparison and alternatives pages (honest) · blog and guides · docs and help centre · customers and case studies (real, named) · about, security, contact · login and app (`noindex`).
- **Schema:** Organization + WebSite on home; `SoftwareApplication` on product pages only with real rating data; `Article`/`TechArticle` on blog and docs; `BreadcrumbList` on docs.
- **Intent map:** problem-aware informational queries (blog) → solution-aware commercial pages (features, use cases) → decision pages (pricing, comparisons, case studies).
- Quick wins: a clear page per use case, real case studies with metrics, integration pages with unique value, fast marketing pages (watch INP from chat and consent scripts), docs indexed with clean URLs.
- Don't: programmatic "X for Y" pages with identical text; gated content with no crawlable summary; app routes in the sitemap.

## 4. Blog, publisher and content sites

**Inventory:** home · category/topic hubs · articles · author pages · about, editorial policy, corrections, contact · newsletter and legal pages · tag archives (usually `noindex` unless curated) · search (`noindex`).
- **Schema:** `Article`/`BlogPosting` with real author and honest dates; `BreadcrumbList`; `ProfilePage`/`Person` on author pages; `Organization` + `WebSite`.
- Authors with real credentials; sources cited; "Last updated" only when content really changed (E-E-A-T, `on-page-and-content.md`).
- Build topic hubs that link to detailed articles and back; fix orphan posts; consolidate overlapping posts.
- **YMYL (health, money, safety):** named expert authors or reviewers, primary-source citations, strict accuracy.
- Don't: mass-publish AI-written posts without review and added value; host third-party "coupon" or "reviews" sections for ranking (site reputation abuse); clutter pages with intrusive ads or interstitials.

## 5. Local service business (single location)

**Inventory:** home · one page per service (real content) · service-area pages **only** where you genuinely serve and can say something specific · about (team, licences) · reviews/testimonials (real) · contact (address, phone, map, hours) · FAQ written for real questions · blog (local expertise).
- **Schema:** the most specific `LocalBusiness` subtype with `address`, `geo`, `openingHoursSpecification`, `telephone`; no star markup for your own reviews.
- **Google Business Profile is half the work**: verified, accurate categories, hours, photos, review replies (`off-page-and-local-seo.md`). NAP identical everywhere.
- Quick wins: fix NAP, add service pages, ask real customers for reviews (without incentive or gating), earn local links (chamber, suppliers, sponsorships).
- Don't: doorway pages for every suburb; keyword-stuffed business names; fake reviews or fake addresses.

## 6. Multi-location business

- One **unique page per location** (local content, team, photos, embedded map, `LocalBusiness` schema, own phone and hours) plus a location index linked from the home page.
- One Business Profile per location; consistent NAP; local citations; reviews per location.
- Avoid thin templates where only the city name changes.

## 7. Portfolio, agency and personal brand

**Inventory:** home · work/case studies (one page each with real outcomes) · services · about/team · blog or insights · contact.
- Each case study: client, problem, approach, measurable result, original images; schema `Article` or `CreativeWork` with honest data.
- Animated portfolio sites: keep real text in the HTML, avoid preloaders on pages that must rank, lazy-load heavy media, check LCP (`ui-ux-for-seo.md`).
- Don't: image-only pages with no text; text embedded in images; infinite WebGL scenes as the only content.

## 8. Marketplace, directory and listings

- Each listing page needs unique, useful content (not just scraped or duplicated fields); thin or empty listings `noindex`.
- Category + location combinations only where there is inventory; empty combinations return 404 or `noindex`.
- Faceted filters controlled as in e-commerce; pagination with unique URLs; user-generated content moderated and links qualified with `ugc`.
- Don't: auto-generate millions of near-identical pages (scaled content abuse); index expired listings without a clear status.

## 9. Documentation and knowledge base

- Stable, human-readable URLs and a clear hierarchy; breadcrumbs with `BreadcrumbList`; `TechArticle` or `Article`.
- One topic per page; titles that state the task or error message users search for; internal links between related pages; versioned docs: canonical to the current version, older versions `noindex` or clearly marked.
- Search inside the docs: `noindex` result pages.

## 10. News and media

- News sitemap (1,000 URL limit), clear bylines and dates, correct `NewsArticle` markup, corrections policy, fast pages, no intrusive interstitials.
- Discover: large images (≥ 1200 px, `max-image-preview:large`), non-clickbait headlines. Verify current Google News and Publisher Center requirements before promising inclusion.

## 11. Multilingual and multi-country sites

See `off-page-and-local-seo.md` section 5: subfolders with reciprocal hreflang, a self-canonical per language, localised titles, URLs, currency and legal details, no automatic redirects by language or IP.

## 12. Always-needed pages for any site

Home · About (real people, address) · Contact · Privacy and terms · a custom **404** that returns HTTP 404 · `robots.txt` · `sitemap.xml` · favicon · for shops: shipping and returns · for content sites: author pages and editorial policy. These support trust (E-E-A-T) and are the most frequent gaps on new sites.
