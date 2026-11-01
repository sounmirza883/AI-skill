# On-page SEO, content and ranking quality

Sources: Google Search Central documents and the Search Status Dashboard, checked 2026-11-01. Items from industry sources
are labelled **(industry)**; heuristics that are not Google statements are labelled **(heuristic)**.

## 1. What actually moves rankings (ordered by how much it usually matters)

1. **The page can be crawled, rendered and indexed** (`technical-seo.md`). Nothing else matters if this fails.
2. **It satisfies the search intent** better than the pages already ranking: right format, right depth, original value.
3. **Trust and experience**: real authors, first-hand evidence, accurate facts, a trustworthy site.
4. **Internal links and site structure** so Google finds the page and understands its importance.
5. **Titles, snippets and page experience** (they affect clicks and eligibility more than raw rank).
6. **External signals** (links, mentions, brand): real but slow, and cannot be shortcut (`off-page-and-local-seo.md`).
Nobody can promise rankings. State it in the report.

## 2. Search intent

| Intent | Typical query | Page that wins | Format cues in the SERP |
|---|---|---|---|
| Informational | "how to read a coverage report" | Guide, tutorial, definition | Featured snippet, People also ask, video, AI Overview |
| Navigational | "fieldnote login" | The brand's own page | Sitelinks |
| Commercial investigation | "best ceramic mugs" | Comparison, review, buying guide | Lists, reviews, forums |
| Transactional | "buy ceramic mug 350 ml" | Product or category page | Shopping results, product cards |
| Local | "plumber near me" | Local landing page, Business Profile | Map pack |

**Classify by the live SERP, not by the keyword's wording.** Open the results: what page types rank (guides, product pages, forums, video, maps)? A May 2026 analysis (industry) found visibility shifts followed whether the *source type* matched the dominant intent. Match the dominant format, then add something the others lack.

## 3. Keyword research and mapping (procedure)

1. **Seeds**: what the product does, customer language (reviews, support tickets, sales calls), Search Console queries, competitor page titles.
2. **Expand**: Search Console (real queries you already get), Google Keyword Planner, Google Trends, autocomplete and People Also Ask, then paid tools (Ahrefs, Semrush, Moz, DataForSEO) if available. Note the data source and date; volumes are estimates.
3. **Open the SERP** for each candidate; record intent, top page types, SERP features (snippet, PAA, AI Overview, video, images, local pack, shopping) and weak results (thin pages, old forum threads).
4. **Cluster**: queries whose top results share URLs belong on one page (**heuristic**: 3 or more shared URLs among the top 10).
5. **One page, one primary keyword** (highest-demand head term with the right intent) plus secondary variants. A page may rank for hundreds of queries.
6. **Prioritise** by business value × demand × feasibility (can you realistically beat the current top results?). Start with striking-distance queries (positions 8-20 in Search Console) and money pages.
7. **Map** clusters to URLs in a sheet: URL | primary keyword | intent | secondary terms | status (exists / refresh / new / merge) | owner.
8. Do not create a separate page for every query wording. Google's 2026 AI guidance warns that mass-producing near-duplicate pages can be **scaled content abuse**.

**Cannibalisation:** in Search Console filter one query and open the Pages tab. Two or more URLs with the same intent swapping places, both stuck low, is the signal. Fix by merging (301 to the stronger page), differentiating intent, or fixing internal links. Several URLs ranking for one query is not automatically a problem; the problem is pages on one topic failing to rank.

**Topic clusters / pillar pages:** no Google statement says "topical authority" is a ranking system. Use clusters because they help users and crawlers (hub page linking to detailed pages that link back), not as a guaranteed factor.

## 4. On-page rules (Google's documentation)

| Element | Rule |
|---|---|
| URL | Short, descriptive, lowercase, hyphens; keywords in the URL have little ranking effect; one URL per piece of content |
| `<title>` | Unique, accurate, concise; main topic early; brand last (`metadata-and-structured-data.md`) |
| `<h1>` | One clear main heading, the most prominent text; agrees with the title. Heading count and order are **not** ranking factors, but keep a logical order for accessibility |
| Opening | Answer the query directly in the first screen. A short answer-first paragraph (about 40-60 words, **heuristic**) followed by depth helps snippets and AI answers |
| Body | Original, specific, first-hand. **No ideal word count** (writing to a word count is a warning sign). Use lists and tables where the query is list-shaped or comparative |
| Internal links | Real `<a href>`; descriptive anchor text, not "click here" and not keyword-stuffed; every indexable page linked from at least 2-3 relevant pages and no orphan pages; link from strong pages (home, hubs) to money pages; no ideal count per page |
| Breadcrumbs | Visible breadcrumb links plus `BreadcrumbList` (shown in desktop results) |
| Images | Real `<img src>` (CSS backgrounds are not indexed); descriptive `alt` (no stuffing); short descriptive file names; modern formats (AVIF, WebP, JPEG, PNG); `srcset`/`sizes`; set `width` and `height` (avoids layout shift); lazy-load below the fold only; image sitemap if images are not discoverable; place images near the related text |
| Video | A dedicated, indexable watch page with the video embedded; stable thumbnail and content URLs; `VideoObject` (`name`, `description`, `thumbnailUrl`, `uploadDate`); optional video sitemap; key moments via `Clip`/`SeekToAction` or YouTube timestamps |
| Dates | Show a visible, honest "Published" and "Last updated" and keep `datePublished`/`dateModified` consistent; changing dates without real updates is a warning sign |
| Duplicates | No "duplicate penalty", but consolidate with 301 or canonical; do not publish many near-identical pages |
| Comments / UGC | Qualify user links with `ugc` or `nofollow`; moderate spam (spammy UGC drags a page down) |

## 5. Quality, E-E-A-T and what Google says about AI content

- **E-E-A-T** (experience, expertise, authoritativeness, trust) is a framework, not a single ranking factor; trust is the most important part. Raters' scores do not change rankings directly. **YMYL** topics (health, finance, safety, civic) get extra scrutiny.
- **Who, How, Why** test for every page: *Who* wrote it (visible byline linking to an author page)? *How* was it made (methodology, how products were tested, AI or automation disclosed where readers would wonder)? *Why* does it exist (for people, not only to catch search traffic)?
- **Site level:** About page with real entity details; Contact page (address, email, phone); editorial and corrections policy; review/testing methodology; for YMYL, named expert authors or reviewers with verifiable credentials and citations to primary sources.
- **Page level:** byline, dated "Last updated", original photos, data and tests, outbound citations to authoritative sources.
- Google evaluates both pages and the whole site; core-update outcomes are reported per site, and a weak section can drag the rest down.
- **AI-generated content (Google, updated 2026-10):** allowed. It is judged on value "no matter how it's created". Mass-producing pages without adding value is **scaled content abuse**. Fact-check everything the model produces (including titles, descriptions, structured data, alt text). Disclose where readers would reasonably wonder. Never invent authors, credentials or AI headshots.
- **Spam policies to remember:** scaled content abuse, site reputation abuse (third-party content hosted to borrow rankings; syndicated news, UGC and editorial columns are fine), expired domain abuse, link spam, back-button hijacking (policy from April 2026, enforced from mid-June; often caused by third-party ad scripts and plugins: audit them), and manipulation of generative AI answers.

## 6. Programmatic and template pages

Only publish a templated page if each URL carries **unique data or value** (a real inventory item, a real location, a real dataset). If many pages say the same thing with swapped nouns, do not publish them, or `noindex` the empty ones. Check a sample of generated pages by hand before shipping thousands.

## 7. Refresh, merge, prune (in this order)

1. **Improve** pages with impressions but weak clicks or positions (better intent match, original evidence, clearer answer, internal links).
2. **Merge** overlapping pages into the strongest one and 301 the others to it.
3. **Remove** pages with no value and no links: 410 or `noindex`. Deleting content is a last resort for quality problems; Google's core-update guidance says avoid quick fixes.

## 8. Page-level on-page checklist (run on any page)

1. **Indexable?** 200, no `noindex`, self-canonical, not blocked, in the sitemap, linked from another page.
2. **One purpose.** One primary keyword and intent; no other URL targets the same intent.
3. **SERP fit.** The format matches what ranks; SERP features noted.
4. **Title** unique and accurate, main term early, no stale year.
5. **H1** matches the title's intent; headings reflect the structure.
6. **Opening** answers the query within the first screen.
7. **Experience and trust.** Named author, honest dates, original evidence, citations; reviewer for YMYL.
8. **Coverage.** Sub-questions and entities covered without padding; clearly adds something the top results do not.
9. **Internal links.** 2-3 relevant inbound links including a hub; contextual outbound links with descriptive anchors.
10. **Images** with alt text, modern format, dimensions set, LCP image not lazy-loaded.
11. **Video** (if any) meets the watch-page requirements and has `VideoObject`.
12. **Structured data** valid and matching visible content; no fake reviews.
13. **Spam check.** No keyword stuffing, hidden text, fabricated authors, scaled thin variants, hosted third-party content for ranking, unwanted redirects or back-button tricks.
14. **Page experience.** Mobile friendly, fast, no intrusive interstitials.
15. **Measure.** Search Console clicks, impressions, position, queries; wait weeks before judging.

## 9. Content brief template

```md
# Brief: <working title>   URL: /<slug>
Primary keyword: …   Secondary (3-8): …
Intent (with evidence from the live SERP): …
SERP format and features: (who ranks, page types, depth, gaps, AI Overview present?)
Audience and goal: what the reader can do afterwards
Unique value / information gain: what we have that others lack (data, experience, tool, expert quote)
Outline: H1 · answer-first block (40-60 words) · H2s from People also ask and gaps · tables/lists · FAQ only if genuinely useful
Entities and topics to cover: …
Author and reviewer (credentials) · sources to cite: …
Internal links: 3 inbound sources (page + anchor), 3-5 outbound targets, hub/pillar relationship
Media: images, video, diagrams with alt text
Structured data: Article/BlogPosting + BreadcrumbList (+ others if they apply)
Cannibalisation check: confirmed no existing URL covers this intent
Dates: published / review schedule
Success metric and review date: e.g. impressions and clicks for the primary query after 6-8 weeks
```

## 10. Myths and facts

| Claim | Status |
|---|---|
| Keyword density targets | Myth; stuffing is spam. Write naturally. |
| Meta keywords | Ignored by Google Search. |
| "LSI keywords" | Not a Google concept. Cover related terms because users need them. |
| Minimum word count | Myth. No minimum or maximum. |
| Domain age, exact-match domains | No evidence of a meaningful boost; keywords in domains and URLs have minimal effect. |
| Heading order or count as a factor | Not a ranking factor. |
| Duplicate content penalty | Myth. It wastes crawl and splits signals. |
| E-E-A-T is a ranking factor | No; Google uses a mix of signals that identify such content. |
| Bounce rate or dwell time as direct signals | Google has said it does not use them directly (not re-verified this session). Click-based systems exist (Google testimony in the US antitrust trial mentions them, **industry reporting**); do not try to manipulate behaviour. |
| Social shares rank pages | No official ranking signal. They help discovery, mentions and links. |
| llms.txt, "chunking", rewriting for AI, AI-only schema | Google says none of this is needed for Search. |
| Subfolder vs subdomain vs TLD | Not a ranking issue by itself; choose for business reasons. |

## 11. Updates and recovery (be factual)

- Confirmed ranking updates: core updates in March 2025, June 2025, December 2025, March 2026, May 2026; spam updates in August 2025, March 2026, June 2026, August 2026 and September 2026 (the longest of 2026, about two weeks). Also a February 2026 Discover update. See Google's Search Status Dashboard for the current list.
- **Google's own core-update guidance:** wait at least a full week after the rollout ends, compare that week with the week before it started, check Web, Images, Video and News separately, avoid quick fixes, deleting content is a last resort, recovery can take months and may need the next core update, and there is no guarantee.
- Typical recovery times quoted by Google staff at a 2026 talk (secondary recap, methodology undisclosed): core update 3-6 months (up to 6-12), spam update 1-2 weeks to months.
- Analyst patterns in 2026 (industry, directional): aggregators, thin affiliate pages, intermediary pages and unreviewed AI content lost visibility; first-party sources, niche specialists and pages with original data gained. Treat as a hypothesis, not a rule.

## 12. Honest timelines to tell the user

| Event | Range |
|---|---|
| Indexed | Hours to weeks; low-quality pages may never be indexed |
| First rankings for a new page | Days to weeks |
| Stable rankings for competitive terms | Months |
| Effect of a content refresh | Typically 2-8 weeks after recrawl |
| Effect of link building | Months; low reply rates are normal |
Faster legitimate levers: internal links from strong pages, an accurate sitemap, fixing blocking technical issues, improving titles on pages already ranking in positions 4-20, earning real mentions.
