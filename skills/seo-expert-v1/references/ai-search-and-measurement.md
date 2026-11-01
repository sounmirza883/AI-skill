# AI search visibility and measurement

Checked 2026-11-01. This area changes monthly: confirm against Google's AI features page and the AI optimization guide before relying on specifics.
Evidence labels: **(official)** Google or vendor documentation; **(industry)** third-party reporting or studies; **(unverified)** could not be confirmed.

## 1. Google AI Overviews and AI Mode (official)

- **No special optimisation is required.** To be used as a source a page must be indexed and eligible for a snippet. No extra technical requirements.
- Both features use **query fan-out** (many related searches behind one question), so cited links can be more varied than classic results.
- Google's guide (updated 2026) says: create **non-commodity, first-hand content**, organise it clearly, keep pages crawlable and fast, and keep Merchant Center and Business Profile data current.
- Google calls these **unnecessary or myths:** `llms.txt`, special AI markup or "AI files", chunking content for AI, rewriting pages "for AI", seeking artificial brand mentions. Structured data must match visible text but is not required for AI features.
- **Mass-producing pages for query variations can violate the scaled-content-abuse policy.** Spam policies now explicitly cover manipulating generative AI answers (May 2026).
- **Controls:** `nosnippet`, `data-nosnippet`, `max-snippet` and `noindex` limit what Search (and AI features) can show. `Google-Extended` controls Gemini training and grounding use; it does **not** affect Search inclusion.
- **`llms.txt`:** Google says Search does not use it. No evidence that any major engine uses it for ranking or citations (unverified for others).

## 2. Practical steps (in order)

1. Confirm the site is crawlable and indexable for Googlebot and Bingbot (`technical-seo.md`).
2. Put a **direct answer in visible text** near the top of pages that target questions.
3. Add **original data, first-hand experience and named expertise**: this is what AI answers cannot get from everyone else.
4. Use structured data for accuracy (Organization, Product, Article…), not as an AI hack.
5. Keep the Merchant Center feed and Business Profile current.
6. Earn real mentions: press, communities, YouTube, review sites. (Industry: a 2025 study of 75,000 brands found branded web mentions correlated most strongly with AI Overview visibility, branded anchors and branded search next, backlinks weakly; correlation, not causation.)
7. Decide the crawler policy per bot (section 3). Check the WAF and CDN are not blocking the bots you chose to allow.

## 3. AI crawlers and robots.txt (official vendor docs)

| Bot | Purpose | Effect of blocking |
|---|---|---|
| `OAI-SearchBot` | ChatGPT search | Removes you from ChatGPT search answers |
| `GPTBot` | OpenAI model training | Opt out of training |
| `ChatGPT-User` | User-triggered fetches | robots.txt may not apply |
| `PerplexityBot` | Perplexity search index (not training) | Allow to appear in answers |
| `Perplexity-User` | User-triggered fetches | Generally ignores robots.txt |
| `Google-Extended` | Gemini training and grounding | No effect on Search inclusion |
| `Applebot` / `Applebot-Extended` | Spotlight, Siri, Safari / training control | Disallowing Extended does not remove you from search |
| `ClaudeBot` | Anthropic training | Opt out of training |
| `Claude-SearchBot` | Anthropic search indexing | Reduces visibility in Claude search |
| `Claude-User` | User-initiated retrieval | Reduces visibility in user-directed search |
Settings are independent per bot and can take about a day to apply. A common, valid stance: **allow search bots, disallow training bots.** Example:

```
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
```
Ask the user which stance they want; it is a business decision, not an SEO default. Verify the list against each vendor's current bot documentation before shipping.

## 4. Measuring AI visibility

| Source | What it shows |
|---|---|
| Search Console Performance (Web) | AI Mode and AI features traffic is counted in the Web totals (since 2025). |
| Search Console **Generative AI performance report** (rolled out 2026) | Impressions in AI Overviews, AI Mode and Discover; appears to be UI-only, so export it manually (industry, unverified API support). |
| Bing Webmaster Tools **AI Performance** | Copilot and Bing AI citations by page and grounding query; no click data; preview since Feb 2026 (industry). |
| GA4 | Referrals from AI assistants. A native "AI Assistant" channel reportedly appeared in May 2026 (industry); otherwise create a custom channel group with a source regex such as `chatgpt\.com\|chat\.openai\.com\|perplexity\.ai\|claude\.ai\|gemini\.google\.com\|copilot\.microsoft\.com`. Treat counts as a **floor** (some tools strip referrers). |
| Prompt sampling | Ask assistants a fixed prompt set on a schedule, record whether and how the brand is cited. Noisy: repeat runs and report ranges. Never claim control over "Google AI rankings". |

## 5. Evidence quality, so the agent does not oversell

- **Established:** Google's statements above and the vendors' bot documentation.
- **Correlational industry research:** brand mentions, branded search and anchors correlate with AI visibility; the authors say correlation is not causation.
- **Vendor studies:** Reddit's and YouTube's share of AI citations differs widely between studies and moves often; do not hard-code numbers.
- **Speculation:** any "GEO tactic" promising citation lifts, including `llms.txt` and chunking. Do not sell these.

## 6. SEO measurement basics

**KPIs by goal**
| Goal | Primary KPIs | Source |
|---|---|---|
| Be found | Indexed pages vs sitemap pages; impressions; non-branded impressions | Search Console |
| Win clicks | Clicks, CTR by page group, striking-distance queries moving up | Search Console |
| Earn business | Organic sessions, conversions, revenue from organic landing pages | GA4 / store analytics |
| Authority | Relevant referring domains, branded search growth | Links report, third-party tools |
| Experience | Share of URL groups with Good LCP, INP, CLS | Search Console CWV, CrUX |

**Reporting rules:** every number carries its source, date range and filters; compare equal-length, weekday-aligned windows; separate branded from non-branded; separate device and country; state when data is preliminary, sampled or top-rows only; show change dates (annotations) next to the charts.

**Baseline before touching anything:** export Search Console performance (queries and pages, 28+ days, final data), the Page indexing counts, Core Web Vitals groups, the sitemap count, and top landing pages with conversions.

**Monthly report template**
```md
## SEO report: <site>, <month>
**Outcome in one line:** <e.g. non-branded clicks +14% vs previous month; 3 indexing blockers fixed>
**Changes shipped:** <date, what, URLs affected>
**Numbers (source, range, filters):** clicks, impressions, CTR, average position (page groups), indexed vs submitted, CWV groups, conversions
**What worked / what did not (with caveats):** <seasonality, updates in the window, other changes>
**Next 30 days:** <3-5 prioritised actions with expected effect and effort>
**Risks and unknowns:** <honest list>
```

## 7. Google updates: how to react

Watch the Search Status Dashboard. After a core update completes, wait at least a week, compare that week with the week before it began, check Web, Images, Video and News separately, and do **not** make rushed sitewide changes. Recovery from a core-update drop usually takes months and may need the next update; there is no guarantee. Spam-update effects can recover faster once the cause is removed. Be suspicious of "winners and losers" blog analyses: they are directional at best.
