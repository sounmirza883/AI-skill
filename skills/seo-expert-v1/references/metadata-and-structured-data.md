# Metadata and structured data (what every page needs)

Checked against Google's documentation on 2026-11-01 (structured data gallery last updated 2026-10-16). Re-check the gallery and
changelog before adding any structured-data type: Google retired many in 2023-2026.

## 1. How to generate metadata for a whole site (agent procedure)

1. List every page **type** the site has (not every page). Use the matrix in section 4.
2. For each type, write a **template** (title and description formulas below) and decide: canonical, robots, schema, Open Graph.
3. Generate real values per page from the page's own data (product name, price, article headline, city). Never reuse one description across pages.
4. Lint the result: every indexable page has a unique title and description; title not empty and not the site name alone; description matches the visible content; canonical is absolute and self-referencing (or deliberately points to the main version); no `noindex` on pages meant to rank.
5. Run `node scripts/seo-audit.mjs <urls>` on the live or local pages to catch missing tags, duplicates, invalid JSON-LD.
6. Re-check after launch with Search Console (Enhancements reports) and the Rich Results Test.

## 2. Title and description

**What Google does:** it builds the title link automatically from `<title>`, the main heading (`<h1>`), `og:title`, other prominent text and
anchor text, and rewrites titles that are half-empty, outdated (old years), inaccurate, copy-pasted boilerplate, in another language, or that just repeat the site name.
Snippets mostly come from the page text; the meta description is used only when it describes the page better than the body does.

| Rule | Detail |
|---|---|
| Length | **Google publishes no character limit**; text is cut by pixel width. Rule of thumb (vendor measurements, UNVERIFIED): title about 50-60 characters (about 580-600 px desktop), description about 150-160 characters (about 920 px desktop, about 120 on mobile). Put the important words first. |
| Unique | Every indexable page has its own title and description. Duplicates are the most common metadata defect. |
| Title formula | `Primary topic or product + qualifier | Brand`. Home page: fuller brand title (`Brand: what you do`). Use `-`, `:` or `|` before the brand. No keyword lists, no ALL CAPS, no stale year. |
| Match the H1 | The `<h1>` and `<title>` should agree in meaning; the H1 is the most prominent text on the page. |
| Description formula | One or two natural sentences: what the page offers + a concrete fact (price, material, location, date, author) + a reason to click. Programmatic descriptions are fine if readable and varied. |
| Not needed | `<meta name="keywords">` (ignored by Google), `<meta name="author">`. |
| Language | Write in the page's language. |

Examples
- Product: `Hand-glazed ceramic mug, 350 ml | Fieldnote` / `Dishwasher-safe stoneware mug in six glazes. $12, ships plastic-free, free returns within 30 days.`
- Article: `How to read a Search Console coverage report | Example` / `A step-by-step guide to every "not indexed" status, what it means and the fix, with screenshots. Updated March 2026.`
- Local service: `Emergency plumber in Leeds, 24/7 | Brook Plumbing` / `Gas Safe registered plumbers in Leeds. Average arrival under 60 minutes, fixed quotes, 4.8 stars from 312 reviews.` (only if the figures are real)

Snippet controls: `nosnippet`, `max-snippet:N`, `data-nosnippet` also limit AI Overviews and AI Mode. Keep important content visible (not inside collapsed or click-only sections) so "read more" deep links can work.

## 3. The `<head>` template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hand-glazed ceramic mug, 350 ml | Fieldnote</title>
  <meta name="description" content="Dishwasher-safe stoneware mug in six glazes. $12, ships plastic-free, free returns within 30 days.">
  <link rel="canonical" href="https://example.com/products/mug">
  <meta name="robots" content="max-image-preview:large">          <!-- omit when you have no special rule; default is index, follow -->

  <link rel="icon" href="/favicon.ico" sizes="48x48">              <!-- square, multiple of 48 px recommended; one per host -->
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">       <!-- 180x180 PNG (common convention) -->

  <!-- Open Graph (link previews: Facebook, LinkedIn, WhatsApp, Slack) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="Hand-glazed ceramic mug, 350 ml">
  <meta property="og:description" content="Dishwasher-safe stoneware mug in six glazes.">
  <meta property="og:url" content="https://example.com/products/mug">
  <meta property="og:image" content="https://example.com/img/mug-1200x630.jpg">
  <meta property="og:image:alt" content="A speckled blue ceramic mug on a wooden table">
  <meta property="og:site_name" content="Fieldnote">
  <meta property="og:locale" content="en_US">

  <!-- X / Twitter -->
  <meta name="twitter:card" content="summary_large_image">

  <!-- Alternate languages (only for real translations) -->
  <link rel="alternate" hreflang="en" href="https://example.com/products/mug">
  <link rel="alternate" hreflang="de" href="https://example.com/de/produkte/tasse">
  <link rel="alternate" hreflang="x-default" href="https://example.com/products/mug">

  <script type="application/ld+json">{ ... }</script>
</head>
```

| Tag | Notes |
|---|---|
| canonical | Absolute URL, self-referencing; in the HTML source (not JS-only). |
| robots | Only when you need a rule. `noindex` on thin or private pages; never combine with canonical. |
| favicon | Square image, at least 8×8 px, more than 48×48 recommended; formats include ICO, PNG, SVG, JPEG, GIF; crawlable by Googlebot and Googlebot-Image; one icon per host; stable URL. |
| Open Graph | Core four: `og:title`, `og:type` (`website`, `article`, `product`…), `og:image` (absolute URL), `og:url`. Image about **1200×630** (vendor convention). `article:published_time`, `article:modified_time`, `article:author` for articles. Google also reads `og:image` as a hint for the preferred thumbnail (avoid logos, text-heavy images, extreme ratios). |
| Twitter/X | `twitter:card=summary_large_image` plus OG fallbacks is enough in practice (X's own docs could not be fetched; UNVERIFIED). |
| WhatsApp | Needs `og:title`, `og:description`, `og:url`, an absolute `og:image`; image under about 300-600 KB; the `<head>` must be inside the first 300 KB of HTML. |
| `theme-color`, `manifest` | Browser UI and installable apps; no effect on Google Search ranking. |
| Link-preview caches | LinkedIn, Facebook and others cache previews; use their debugger tools to refresh after changes. |

## 4. Metadata matrix by page type

T = unique title, D = unique description, C = canonical, OG = Open Graph, S = structured data.

| Page type | T / D | Canonical | Robots | Structured data | OG | Notes |
|---|---|---|---|---|---|---|
| Home | T (fuller brand) / D | self | index | `Organization` + `WebSite` | yes | WebSite gives Google the site name; home page only |
| Category / listing | T / D | self | index | `BreadcrumbList`; optionally `ItemList` | yes | Unique intro text; do not leave the page as a bare grid |
| Product | T / D | self | index | `Product` + `Offer`, `BreadcrumbList`, review/rating **only if real** | yes (`og:type=product`) | Price and availability in markup must match the page |
| Product variants | T / D | one canonical to the main product (if variants are only parameters) or self (if each is a real page) | index | `ProductGroup` / variants | yes | Each variant URL shows its own price and image |
| Blog post / article | T / D | self | index | `BlogPosting` or `Article`, `BreadcrumbList` | `og:type=article` | Real author, `datePublished`, honest `dateModified` |
| Blog index, page 2+ | T / D with page number | self (**not** page 1) | index | `BreadcrumbList` | yes | `rel=prev/next` is ignored by Google |
| Tag / author archive | T / D | self | `noindex, follow` if thin; index if curated | `ProfilePage` for real authors | optional | Do not index dozens of near-empty tag pages |
| About | T / D | self | index | `Organization` (and `AboutPage`) | yes | Trust page: real names, address, history |
| Contact | T / D | self | index | `LocalBusiness` or `ContactPoint` | optional | |
| Pricing | T / D | self | index | `Offer`/`Product` only if purchasable online | yes | |
| Landing page (organic) | T / D | self | index | optional | yes | |
| Landing page (paid only) | T | self | `noindex` | none | none | Prevent duplicate-content clutter |
| Docs / help article | T / D | self | index | `TechArticle` or `Article`, `BreadcrumbList` | optional | |
| Internal search results | none | self or none | `noindex, follow` | none | none | Prevent crawl traps |
| Login, account, cart, checkout, thank-you | T only | none | `noindex` (page must stay crawlable so Google can see it) | none | none | Also needs real auth |
| 404 page | T | none | **HTTP 404 status** | none | none | Never return 200 for a missing page |
| Filtered / faceted URLs | inherit | canonical to the unfiltered page | block in robots.txt for crawl traps, or leave canonicalised | none | none | See `technical-seo.md` |
| Print versions | inherit | to the main page | `noindex` | none | none | |
| Staging / dev | none | none | HTTP auth (preferred) and `noindex` | none | none | Never rely on robots.txt alone |

`noindex` removes a page from the index but needs crawl access. `Disallow` blocks crawling only. Canonical consolidates duplicates; do not use `noindex` for that.

## 5. Structured data rules

- Prefer **JSON-LD** in `<head>` or `<body>`. Microdata and RDFa also work.
- Markup must describe **content that is visible on the same page** and be accurate. Mark up everything of that kind on the page, not just some items.
- Include all required properties, use the most specific type, give each entity an `@id` and link entities (publisher → Organization) instead of repeating them.
- Do not block marked-up pages with robots.txt or `noindex`. Dates need a timezone (`2026-03-01T09:00:00+00:00`).
- Valid markup does not guarantee a rich result. Validators: **Rich Results Test**, **Schema Markup Validator** (validator.schema.org), URL Inspection, Search Console Enhancements and Merchant listings reports (the Mobile-Friendly Test is retired).
- Structured data is not needed for AI Overviews and is not an AI ranking hack; use it for accuracy.
- Manual actions for structured data remove rich-result eligibility; they do not change normal ranking.

### Supported and retired types (verify against the gallery before use)

| Status | Types |
|---|---|
| **Supported** (Google gallery, 2026-10) | Article, Breadcrumb (desktop only), Carousel (beta), Course list, Dataset (Dataset Search only), Discussion forum, Education Q&A, Employer aggregate rating, Event (physical events only), Image metadata, Job posting, Local business, Math solver, Movie, Organization, Product (snippets, merchant listings, variants), Profile page, Q&A, Recipe, Review snippet, Software app, Speakable (beta, US English), Subscription / paywalled content, Vacation rental, Video |
| **Retired / no rich result** | **FAQ** (restricted to government and health sites in Sep 2023; feature ended 2026-05-07; docs removed 2026-06-15), **HowTo** (2023), Sitelinks search box (2024), Home activity, Guided recipes, Course info, Estimated salary, Learning video, Special announcement, Vehicle listing (all 2025), Book actions, Practice problem (Nov 2025 and Jan 2026) |
| **Phasing out** | ClaimReview / fact check in Google Search (no end date) |
Never add FAQ or HowTo markup "to get rich results" any more. Leaving existing markup is harmless but pointless.

### Required and recommended properties (from Google's documentation)

| Type | Required | Recommended / notes |
|---|---|---|
| Organization | none | `name`, `url`, `logo` (≥ 112×112, crawlable), `sameAs`, `address`, `contactPoint`, `legalName`, `telephone`; use the most specific subtype (`OnlineStore`); put on home or about page |
| WebSite (site name) | `name`, `url` | `alternateName`; home page only; extend the existing node, do not add a second |
| LocalBusiness | `name`, `address` | `geo` (5+ decimals), `telephone`, `url`, `openingHoursSpecification` (hh:mm:ss), `priceRange`, subtype such as `Restaurant`; reviews of your **own** business are not eligible for stars |
| BreadcrumbList | ≥ 2 `ListItem` with `position`, `name`, `item` (URL; last may omit `item`) | Visible breadcrumb on the page too |
| Article / BlogPosting / NewsArticle | none | `headline`, `image` (several ratios: 1:1, 4:3, 16:9), `datePublished`, `dateModified`, `author` (name + url), `publisher` |
| Product (snippet) | `name` + one of `review`, `aggregateRating`, `offers` | `brand`, `sku`, `gtin`, `image`, `description` |
| Product (merchant listing) | `name`, `image`, `offers` (an `Offer`, not `AggregateOffer`) with `price` > 0 and `priceCurrency` | `availability`, `itemCondition`, `priceValidUntil`, `shippingDetails`, `hasMerchantReturnPolicy`, GTIN/MPN/brand/SKU/colour/size |
| Return / shipping policy | return: `applicableCountry` + `returnPolicyCategory` (+ `merchantReturnDays` if finite) or `merchantReturnLink`; shipping: `shippingConditions` | Best set once at Organization level; Merchant Center settings override |
| Product variants | `ProductGroup` + `hasVariant`, `variesBy`, `productGroupID` | Each variant needs a unique `sku` or `gtin` and its own preselectable URL |
| Review / AggregateRating | `author`, `itemReviewed`, `reviewRating.ratingValue`; aggregate: `ratingValue` + `ratingCount` or `reviewCount` | No fake, self-written, or undisclosed-incentivised reviews; do not aggregate other sites' reviews |
| ProfilePage | `mainEntity` (Person or Organization) | `dateCreated`, `dateModified`, `sameAs`, `image` |
| SoftwareApplication / WebApplication | `name`, `offers.price` (0 if free), and `aggregateRating` or `review` | `applicationCategory`, `operatingSystem` |
| Event | `name`, `startDate`, `location` (Place with address) | `endDate`, `eventStatus`, `offers`, `organizer`, `image`; virtual-only events unsupported |
| JobPosting | `title`, `description`, `datePosted`, `hiringOrganization`, `jobLocation` (or remote requirements) | `validThrough`, `baseSalary`, `employmentType`, `directApply` |
| Recipe | `name`, `image` | `author`, times, `recipeYield`, `recipeIngredient`, `recipeInstructions`, `nutrition`, `aggregateRating`, `video` |
| VideoObject | `name`, `thumbnailUrl`, `uploadDate` | `contentUrl` or `embedUrl`, `duration`, `creator`, `hasPart` (Clip) |
| Dataset | `name`, `description` (50-5000 characters) | `license`, `creator`, `distribution`, `temporalCoverage` |
| Image metadata | `contentUrl` + one of `creator`, `creditText`, `copyrightNotice`, `license` | `acquireLicensePage` for the Licensable badge |
| Discussion forum | `author.name`, `datePublished`, and one of `text`/`image`/`video` | `comment`, `interactionStatistic` |

### JSON-LD templates

Organization + WebSite (home page)
```json
{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","@id":"https://example.com/#org","name":"Example Inc","url":"https://example.com/",
  "logo":"https://example.com/logo-512.png","sameAs":["https://www.linkedin.com/company/example"]},
 {"@type":"WebSite","@id":"https://example.com/#site","url":"https://example.com/","name":"Example","alternateName":"Example Inc",
  "publisher":{"@id":"https://example.com/#org"}}]}
```

Product with Offer (only include `aggregateRating` if the ratings are real and shown on the page)
```json
{"@context":"https://schema.org","@type":"Product","name":"Example Widget",
 "image":["https://example.com/w-1x1.jpg"],"description":"A compact widget.","sku":"WID-1001",
 "brand":{"@type":"Brand","name":"ExampleCo"},
 "offers":{"@type":"Offer","url":"https://example.com/widget","price":29.99,"priceCurrency":"USD",
  "availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition",
  "hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy","applicableCountry":"US",
   "returnPolicyCategory":"https://schema.org/MerchantReturnFiniteReturnWindow","merchantReturnDays":30,"returnFees":"https://schema.org/FreeReturn"}}}
```

BlogPosting
```json
{"@context":"https://schema.org","@type":"BlogPosting","headline":"Example Article Title",
 "image":["https://example.com/1x1.jpg","https://example.com/4x3.jpg","https://example.com/16x9.jpg"],
 "datePublished":"2026-03-01T09:00:00+00:00","dateModified":"2026-03-15T14:30:00+00:00",
 "author":[{"@type":"Person","name":"Sample Author","url":"https://example.com/authors/sample"}],
 "publisher":{"@id":"https://example.com/#org"},"mainEntityOfPage":"https://example.com/blog/post"}
```

LocalBusiness (use the most specific subtype)
```json
{"@context":"https://schema.org","@type":"Plumber","name":"Brook Plumbing","url":"https://example.com/leeds","telephone":"+441130000000",
 "priceRange":"££","address":{"@type":"PostalAddress","streetAddress":"1 High St","addressLocality":"Leeds","postalCode":"LS1 1AA","addressCountry":"GB"},
 "geo":{"@type":"GeoCoordinates","latitude":53.79648,"longitude":-1.54785},
 "openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00:00","closes":"18:00:00"}]}
```

BreadcrumbList
```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
 {"@type":"ListItem","position":1,"name":"Shop","item":"https://example.com/shop"},
 {"@type":"ListItem","position":2,"name":"Mugs","item":"https://example.com/shop/mugs"},
 {"@type":"ListItem","position":3,"name":"Hand-glazed mug"}]}
```

SoftwareApplication (needs real rating or review data to be eligible)
```json
{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Example App","operatingSystem":"ANDROID","applicationCategory":"BusinessApplication",
 "aggregateRating":{"@type":"AggregateRating","ratingValue":4.6,"ratingCount":8864},"offers":{"@type":"Offer","price":0,"priceCurrency":"USD"}}
```

### Structured data mistakes that cause problems

- Marking up content that is not visible or does not match the page; fake, self-written or undisclosed-incentivised reviews; self-serving review stars on Organization or LocalBusiness pages; reviews aggregated from other sites.
- Misleading types (instructions as a Recipe, a broadcast as a local Event); impersonating a person or organisation.
- Missing required properties; stale time-sensitive data; price or availability that differs from the page; `AggregateOffer` for merchant listings; conflicting `price` and `priceSpecification`.
- Dates without a timezone; duplicate competing blocks (a second `WebSite` node instead of extending the first).
- Blocking the marked-up page with robots.txt or `noindex`.

## 6. Framework snippets

Next.js (App Router)
```ts
// app/products/[slug]/page.tsx  (Server Component)
export async function generateMetadata({ params }) {
  const p = await getProduct(params.slug);      // call notFound() here, before any slow await or Suspense boundary
  return {
    title: `${p.name} | Fieldnote`,
    description: p.summary,
    alternates: { canonical: `/products/${p.slug}`, languages: { de: `/de/produkte/${p.slugDe}` } },
    openGraph: { title: p.name, description: p.summary, url: `/products/${p.slug}`, images: [{ url: p.ogImage, width: 1200, height: 630 }] },
  };   // set metadataBase in the root layout; a child openGraph replaces the parent's entirely
}
// JSON-LD: render <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
```
Also `app/sitemap.ts` (`MetadataRoute.Sitemap`, `generateSitemaps` above 50,000 URLs) and `app/robots.ts`.
Nuxt: `useSeoMeta()`. Astro: `<head>` in the layout and `@astrojs/sitemap` (needs `site`). SvelteKit: `<svelte:head>`. Plain HTML: the template in section 3.
When writing JSON-LD from user data, escape `<` as `<` so data can never close the script tag.
