# Off-page, local and international SEO

Official statements come from Google's documentation (checked 2026-11-01); anything from industry sources is labelled **(industry)**.
The agent can plan, research and **draft** off-page work, but a person sends the outreach, owns the accounts and pays any costs.

## 1. Links: what Google actually says

**Link spam policy:** links created to or from a site mainly to manipulate rankings. Listed examples: buying or selling links (including free product in exchange for a link); excessive link exchanges or partner pages used only for cross-linking; automated link creation; requiring links in terms of service; advertorials, native ads, guest posts or press releases with ranking-passing links or optimised anchors; low-quality directories and bookmark sites; keyword-rich or hidden links in widgets spread across sites; widely distributed footer or template links; forum or signature links with optimised anchors; low-value content made only to carry links.
Paid links are **not** a violation if qualified with `rel="nofollow"` or `rel="sponsored"`.

**Link attributes** (on crawlable `<a>` elements): `sponsored` for ads and paid placements (preferred over nofollow for them), `ugc` for comments and forum posts, `nofollow` when you do not want to be associated with the target. Values can be combined (`ugc nofollow`). Use robots.txt to stop crawling and `noindex` to stop indexing; the attributes do neither.

**How much do links matter?** Still a signal, but Google staff statements (industry reports of 2023-2024) say they are not the top few factors and that a site needs relatively few good ones. Prefer earned links over volume. There was no new official statement in 2025-2026.

**Disavow** (Google calls it advanced and says most sites do not need it): use only if you have, or expect, a manual action for unnatural links **and** have many spammy links you could not get removed. File format: `.txt`, UTF-8 or ASCII, one URL or `domain:example.com` per line, `#` comments, up to 2 MB and 100,000 lines, one list per property (a new upload replaces the old one); not available for domain properties; changes take weeks. Do not disavow "toxic score" links pre-emptively.

**Recovering from a manual action for unnatural links**
1. Export links from Search Console (largest and newest linking sites first).
2. Ask site owners to remove the links or add `nofollow`.
3. Disavow only what could not be removed (disavowing everything without a removal attempt can get the request rejected).
4. Fix **all** affected pages: partial fixes get no partial recovery.
5. Manual Actions report → **Request review**; document the problem, the steps taken, and the links removed and disavowed. Link reviews are slow; do not resubmit while one is pending.
For outbound-link actions, remove the links or qualify them.

## 2. Earning links and mentions (ethical methods, roughly by effort)

1. **Reclaim unlinked brand mentions**: search the brand name, find mentions without a link, ask politely.
2. **Redirect dead URLs** that other sites still link to (301 to the closest equivalent): the cheapest win.
3. **Original data or a useful free asset**: survey, benchmark, calculator, free tool, an industry statistics page; pitch it to relevant journalists and bloggers.
4. **Digital PR** with real expert commentary (reactive quote platforms, journalist requests).
5. **Resource-page and broken-link outreach**, only when your page is genuinely better.
6. **Partnerships and associations**: suppliers, manufacturers, trade bodies, local chambers (a legitimate source for local SEO), sponsorships.
7. **Podcasts and speaking** (bio links).
8. **Community presence**: YouTube, LinkedIn, relevant forums; their visibility often shows in results and in AI answers.

**Finding opportunities:** free: Search Console Links report (export), Bing Webmaster Tools inbound links; paid: Ahrefs, Semrush, Moz for competitor gaps ("sites linking to rivals but not to you").
**Judging a prospect:** real organic traffic and topical relevance; editorial standards (no "write for us" or paid-post pages, no link-farm patterns); editorial outbound links; would you want the link even if it passed no ranking value?
**Outreach email structure:** (1) a short personal hook showing you read their piece; (2) the specific value you offer, with one stat or asset; (3) one clear ask; (4) an easy opt-out; (5) at most one follow-up. The agent drafts; the user sends.
**KPIs:** relevant referring domains gained, links to money pages, branded search volume in Search Console, referral traffic, AI citations or mentions. Avoid vanity metrics such as total backlink count. Expect low reply rates and months, not weeks.

| Do | Don't |
|---|---|
| Earn links with assets, data and PR | Buy links, or swap goods for links without `rel="sponsored"` |
| `sponsored`/`nofollow` for paid, affiliate and gifted-product links | PBNs, link exchanges, mass directory submissions |
| Disavow only with a manual action and failed removals | Disavow by a third-party "toxicity" score |
| Natural anchors | Optimised anchors in guest posts, press releases or widgets |
| Search Console as the free source of truth | Treat vendor authority scores as policy evidence |

## 3. Brand and entity signals

- **Organization structured data** on the home or About page: most specific subtype, `name`, `url`, `logo` (≥ 112×112, crawlable), `sameAs` (social and review profiles), address and contact points. It helps Google tell you apart from similarly named organisations and can influence knowledge-panel details.
- **Reviews:** fake or undisclosed incentivised reviews are prohibited; self-controlled reviews of your own business make Organization and LocalBusiness pages ineligible for star snippets (including third-party widgets embedding your reviews); do not aggregate other sites' reviews.
- **Wikipedia and Knowledge Panels (industry):** Wikipedia notability needs significant independent coverage; businesses cannot opt in and should not write their own page. Do not promise a Knowledge Panel; earn press coverage first.
- **Consistency:** same name, logo and description across the site, Business Profile, social profiles and directories; link social profiles from the site and in `sameAs`. Brand searches are an outcome to monitor, not a lever to game.

## 4. Local SEO

**How Google ranks local results (official):** relevance, distance and prominence (links, review count and ratings). "There's no way to request or pay for a better local ranking."

**Google Business Profile (GBP) guidelines**
- Eligibility: a real location customers can visit, or a business that travels to customers; one profile per business; virtual offices and P.O. boxes are ineligible; co-working spaces only with signage and staff during hours.
- Name: the real-world name only, no keywords, taglines, hours or services.
- Address: service-area businesses hide the address if customers do not visit; service areas generally stay within about 2 hours' drive.
- Categories: as few as possible, as specific as possible; describe what the business **is**.
- Hours: regular customer-facing hours plus special and holiday hours.
- Phone and website: a location-specific number and URL, not a redirect to social pages or ordering platforms.
- Description: no links, promotions or prices.

**Review policy (official):** prohibited are paid or incentivised reviews, review gating (selectively asking happy customers), staff quotas, requiring reviews on premises, and conflict-of-interest reviews from staff, family or competitors. Allowed: asking genuine customers without incentive or steering.

**Setup checklist for the agent (the user does the account actions)**
1. Verify the profile (video verification is common, industry).
2. Choose one primary category and a few secondary ones.
3. Add services, products, attributes, regular and special hours, real photos and video.
4. Reply to every review.
5. Build a **unique location page per physical location**: local content, embedded map, `LocalBusiness` schema, internal links from a location index.
6. Service-area business: one page per genuinely served area with real content; no doorway pages.
7. Keep **NAP** (name, address, phone) identical on the site, the profile and citations (Bing Places, Apple Business Connect and relevant directories).
Industry reports (UNVERIFIED): Business Profile Q&A API ended in late 2025 and the public Q&A box is being replaced by AI features; check the current Business Profile help before relying on Q&A.

## 5. International SEO

| Structure | Pros | Cons |
|---|---|---|
| ccTLD (`example.de`) | Clear country signal, separate setup | Costly, one country each |
| Subdomain (`de.example.com`) | Easy; can be hosted separately | Users may not tell language from country |
| Subfolder (`example.com/de/`) | Easy, low maintenance | Weaker geo signal, harder to split later |
| URL parameter (`?loc=de`) | none | Not recommended |
Default for most sites: **subfolders with hreflang**, unless there is a strong legal or business reason for ccTLDs. Other geo signals: local addresses and phones, language and currency, local links. Google ignores `geo.*` meta tags; server location is a weak signal.

**hreflang rules:** one method (HTML `<link>`, HTTP `Link` header for non-HTML files, or sitemap). Every version lists itself and all others; return links are mandatory or the annotations are ignored; fully qualified URLs; ISO 639-1 language with optional ISO 3166-1 region (`en-GB`, not `en-UK`; a region alone is invalid; `zh-Hant` works); `x-default` for unmatched languages or a selector page. Google detects language from visible content, not from hreflang or the `lang` attribute.

**Localisation:** separate URLs per language (never cookies, `Accept-Language` or IP detection: Googlebot crawls from the US without a language header); no automatic redirects by guessed language, offer a switcher; one language per page including navigation; translate titles, descriptions, URLs, currency, shipping, legal and contact details. Translated pages are not duplicates; only untranslated copies are.

## 6. Social, Discover, Images, News

- **Social:** no official ranking signal; it drives discovery, brand searches and mentions that can lead to links.
- **YouTube / video:** good titles, descriptions, chapters, thumbnails, captions; `VideoObject` on your own watch pages.
- **Discover** (official): automatic if indexed and policy-compliant; no special tags; avoid clickbait; images at least 1200 px wide with `max-image-preview:large`; Search Console shows a Discover report once there is enough traffic. A February 2026 Discover update favoured locally relevant and less sensational content.
- **Google Images:** descriptive alt text, descriptive file names, modern formats (AVIF, WebP), `srcset`, image sitemap if images are hard to discover.
- **Google News / Top Stories:** news-style site with clear bylines and dates and a news sitemap; Publisher Center is optional (official pages could not be fetched, so verify current requirements).
