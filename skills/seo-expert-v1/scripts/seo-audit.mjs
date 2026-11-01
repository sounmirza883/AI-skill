#!/usr/bin/env node
// Quick on-page and indexability audit of specific URLs (zero dependencies).
// Usage: node seo-audit.mjs <url> [url ...] [--sitemap <sitemap-url>] [--max 50] [--json]
// Only audit sites you own or have permission to test. It fetches the RAW HTML (what a crawler gets before JavaScript runs),
// so it does not see content rendered in the browser: confirm those pages with Search Console's URL Inspection live test.
// shortcut: audits only the URLs you give (or the sitemap lists); it does not follow links. Use a crawler for site-wide discovery.
import { fileURLToPath } from 'node:url';

// Guidance values, not hard Google limits (Google rewrites titles/descriptions and truncates by pixel width, roughly 580 px / 920 px).
export const LIMITS = { titleMin: 20, titleMax: 60, descMin: 70, descMax: 160, thinWords: 50 };
const UA = 'seo-audit-script/1.0 (+owner-run audit)';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)].map((m) => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
const all = (html, re) => [...html.matchAll(re)].map((m) => m[0]);

// Pure analysis of one fetched page. Returns { facts, findings: [{ code, severity, message }] }.
export function analyze({ url, finalUrl, status, headers = new Headers(), body = '', chain = [], error }) {
  const f = [];
  const add = (code, severity, message) => f.push({ code, severity, message });
  const facts = { url, finalUrl, status, redirects: chain.length };
  if (error) { add('FETCH_FAILED', 'error', error); return { facts, findings: f }; }
  if (status !== 200) add('STATUS_NOT_200', status >= 400 ? 'error' : 'warn', `Final status ${status}`);
  if (chain.length > 1) add('REDIRECT_CHAIN', 'warn', `${chain.length} redirects before the final URL; link straight to the final URL`);
  else if (chain.length === 1) add('REDIRECT', 'info', `Redirects once (${chain[0].status}) to ${finalUrl}`);
  if (!finalUrl.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(finalUrl)) add('NOT_HTTPS', 'warn', 'Page is not served over HTTPS');
  const xr = headers.get('x-robots-tag') || '';
  if (/noindex/i.test(xr)) add('X_ROBOTS_NOINDEX', 'warn', `X-Robots-Tag header says "${xr}" (page will not be indexed)`);
  const ctype = headers.get('content-type') || '';
  if (!/html/i.test(ctype)) { add('NOT_HTML', 'info', `Content-Type is ${ctype || 'missing'}`); return { facts, findings: f }; }

  const head = body.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? body;
  const title = decode(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const metas = all(head, /<meta\b[^>]*>/gi).map(attrs);
  const meta = (name) => metas.find((m) => (m.name || '').toLowerCase() === name)?.content?.trim() ?? '';
  const prop = (p) => metas.find((m) => (m.property || '').toLowerCase() === p)?.content?.trim() ?? '';
  const links = all(head, /<link\b[^>]*>/gi).map(attrs);
  const desc = decode(meta('description'));
  const robots = meta('robots') + ' ' + meta('googlebot');
  Object.assign(facts, { title, description: desc });

  if (!title) add('TITLE_MISSING', 'error', 'No <title>');
  else if (title.length < LIMITS.titleMin) add('TITLE_SHORT', 'warn', `Title is ${title.length} characters`);
  else if (title.length > LIMITS.titleMax) add('TITLE_LONG', 'info', `Title is ${title.length} characters; Google may cut it (about ${LIMITS.titleMax})`);
  if (!desc) add('DESC_MISSING', 'warn', 'No meta description (Google will pick text from the page)');
  else if (desc.length > LIMITS.descMax) add('DESC_LONG', 'info', `Description is ${desc.length} characters (about ${LIMITS.descMax} fit)`);
  else if (desc.length < LIMITS.descMin) add('DESC_SHORT', 'info', `Description is ${desc.length} characters`);
  if (/noindex/i.test(robots)) add('ROBOTS_NOINDEX', 'warn', 'Meta robots contains noindex: intended?');
  if (!meta('viewport')) add('VIEWPORT_MISSING', 'error', 'No viewport meta tag (mobile-first indexing)');
  if (!/<html[^>]*\blang=/i.test(body)) add('LANG_MISSING', 'info', '<html> has no lang attribute');

  const canon = links.filter((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canon.length === 0) add('CANONICAL_MISSING', 'warn', 'No rel=canonical');
  else if (canon.length > 1) add('CANONICAL_MULTIPLE', 'error', `${canon.length} canonical tags`);
  else {
    const c = new URL(canon[0].href || '', finalUrl).href;
    facts.canonical = c;
    if (c.replace(/\/$/, '') !== finalUrl.replace(/\/$/, '')) add('CANONICAL_DIFFERENT', 'warn', `Canonical points elsewhere: ${c}`);
  }

  const heads = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: decode(m[2].replace(/<[^>]+>/g, '')) }));
  const h1s = heads.filter((h) => h.level === 1);
  if (h1s.length === 0) add('H1_MISSING', 'warn', 'No <h1> in the HTML');
  else if (h1s.length > 1) add('H1_MULTIPLE', 'info', `${h1s.length} <h1> elements`);
  if (heads.some((h, i) => i && h.level > heads[i - 1].level + 1)) add('HEADING_SKIP', 'info', 'Heading levels skip (for example h2 to h4)');

  if (!prop('og:title') || !prop('og:image')) add('OG_INCOMPLETE', 'info', 'Open Graph og:title or og:image missing (link previews)');
  if (!meta('twitter:card')) add('TWITTER_CARD_MISSING', 'info', 'No twitter:card');

  const types = [];
  for (const m of body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n['@type']) types.push([].concat(n['@type']).join('/')); walk(n['@graph']); } };
      walk(JSON.parse(m[1]));
    } catch { add('JSONLD_INVALID', 'error', 'A JSON-LD block is not valid JSON'); }
  }
  facts.schemaTypes = types;
  if (!types.length && !f.some((x) => x.code === 'JSONLD_INVALID')) add('JSONLD_NONE', 'info', 'No structured data found');

  const imgsNoAlt = all(body, /<img\b[^>]*>/gi).filter((t) => !('alt' in attrs(t))).length;
  if (imgsNoAlt) add('IMG_ALT_MISSING', 'warn', `${imgsNoAlt} <img> without an alt attribute`);
  const anchors = all(body, /<a\b[^>]*>/gi).map(attrs);
  const hash = anchors.filter((a) => /^#(\/|!)/.test(a.href || '')).length;
  if (hash) add('HASH_ROUTES', 'error', `${hash} links use #/ or #! routes; Google ignores URL fragments, so those pages cannot be indexed`);
  const dead = anchors.filter((a) => !a.href || /^(javascript:|#$)/.test(a.href)).length;
  if (dead) add('LINKS_NOT_CRAWLABLE', 'warn', `${dead} <a> elements without a real href (crawlers only follow href links)`);

  const text = decode(body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]+>/g, ' '));
  facts.words = text ? text.split(' ').length : 0;
  if (facts.words < LIMITS.thinWords) add('THIN_RAW_HTML', 'warn', `Only ${facts.words} words in the raw HTML: content may be rendered by JavaScript. Confirm with URL Inspection (live test).`);
  return { facts, findings: f };
}

async function get(url) {
  const chain = [];
  let cur = url;
  try {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { chain.push({ url: cur, status: res.status }); cur = new URL(loc, cur).href; continue; }
      return { url, finalUrl: cur, status: res.status, headers: res.headers, body: await res.text(), chain };
    }
    return { url, finalUrl: cur, status: 0, chain, error: 'Too many redirects (10+)' };
  } catch (e) { return { url, finalUrl: cur, status: 0, chain, error: e.message }; }
}

// Site-level files: robots.txt and a sitemap.
export async function siteChecks(origin) {
  const f = [];
  const add = (code, severity, message) => f.push({ code, severity, message });
  const r = await get(`${origin}/robots.txt`);
  let sitemapUrl = null;
  if (r.status !== 200) add('ROBOTS_TXT_MISSING', 'warn', `/robots.txt returned ${r.status || r.error}`);
  else {
    const groups = r.body.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim());
    let star = false;
    for (const l of groups) {
      if (/^user-agent:\s*\*/i.test(l)) star = true; else if (/^user-agent:/i.test(l)) star = false;
      if (star && /^disallow:\s*\/\s*$/i.test(l)) add('ROBOTS_BLOCKS_ALL', 'error', 'robots.txt has "Disallow: /" for all crawlers');
    }
    sitemapUrl = groups.find((l) => /^sitemap:/i.test(l))?.replace(/^sitemap:\s*/i, '') ?? null;
    if (!sitemapUrl) add('ROBOTS_NO_SITEMAP', 'info', 'robots.txt has no Sitemap: line');
  }
  const s = await get(sitemapUrl || `${origin}/sitemap.xml`);
  if (s.status !== 200 || !/<(urlset|sitemapindex)/i.test(s.body || '')) add('SITEMAP_MISSING', 'warn', `No valid sitemap at ${sitemapUrl || `${origin}/sitemap.xml`}`);
  return f;
}

export async function sitemapUrls(url, depth = 0) {
  const r = await get(url);
  const locs = [...(r.body || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
  if (/<sitemapindex/i.test(r.body || '') && depth < 1) return (await Promise.all(locs.map((l) => sitemapUrls(l, depth + 1)))).flat();
  return locs;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const max = Number(opt('--max') || 50);
  const skip = new Set([opt('--sitemap'), opt('--max')].filter(Boolean));
  let urls = args.filter((a) => /^https?:\/\//.test(a) && !skip.has(a));
  if (opt('--sitemap')) urls.push(...(await sitemapUrls(opt('--sitemap'))));
  urls = [...new Set(urls)].slice(0, max);
  if (!urls.length) { console.error('Usage: node seo-audit.mjs <url> [url ...] [--sitemap <url>] [--max 50] [--json]'); process.exit(2); }

  const pages = [];
  for (const u of urls) { pages.push(analyze(await get(u))); await new Promise((r) => setTimeout(r, 200)); } // polite: one at a time
  const dup = (key, code, label) => { // same title or description on several pages
    const seen = {};
    for (const p of pages) if (p.facts[key]) (seen[p.facts[key]] ||= []).push(p);
    for (const group of Object.values(seen)) if (group.length > 1) for (const p of group) p.findings.push({ code, severity: 'warn', message: `${label} is shared with ${group.length - 1} other audited page(s)` });
  };
  dup('title', 'TITLE_DUPLICATE', 'Title'); dup('description', 'DESC_DUPLICATE', 'Description');
  const site = await siteChecks(new URL(urls[0]).origin);

  if (json) console.log(JSON.stringify({ site, pages }, null, 2));
  else {
    const mark = { error: 'ERROR', warn: 'warn ', info: 'info ' };
    console.log(`\nSite checks (${new URL(urls[0]).origin})`);
    for (const x of site) console.log(`  ${mark[x.severity]} ${x.code}: ${x.message}`);
    if (!site.length) console.log('  ok');
    for (const p of pages) {
      console.log(`\n${p.facts.url}  [${p.facts.status}]  title: ${p.facts.title || '(none)'}  schema: ${(p.facts.schemaTypes || []).join(', ') || '(none)'}`);
      for (const x of p.findings) console.log(`  ${mark[x.severity]} ${x.code}: ${x.message}`);
      if (!p.findings.length) console.log('  ok');
    }
  }
  const all2 = [...site, ...pages.flatMap((p) => p.findings)];
  const n = (s) => all2.filter((x) => x.severity === s).length;
  if (!json) console.log(`\n${pages.length} page(s): ${n('error')} errors, ${n('warn')} warnings, ${n('info')} notes`);
  process.exitCode = n('error') ? 1 : 0;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
