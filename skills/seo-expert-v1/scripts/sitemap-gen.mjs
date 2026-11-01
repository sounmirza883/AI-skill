#!/usr/bin/env node
// Builds sitemap.xml from a folder of built HTML files or from a list of URLs (zero dependencies).
// Usage: node sitemap-gen.mjs --base https://example.com (--dir ./public | --urls urls.txt) [--out ./public/sitemap.xml] [--lastmod]
// --dir  : every .html file becomes a URL (index.html -> /, a/index.html -> /a/, a.html -> /a.html); files with a noindex meta tag, 404.html and 500.html are skipped.
// --urls : one URL or path per line (lines starting with # are ignored).
// --lastmod adds each file's modified date. Off by default: a build step usually resets every file date, and Google only trusts lastmod when it is consistently accurate.
// Sitemaps are limited to 50,000 URLs and 50 MB each; more URLs are split into sitemap-1.xml, sitemap-2.xml ... plus an index at --out.
// shortcut: maps files to URLs one to one; if your host rewrites to clean URLs (/about for about.html) use --urls instead.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const MAX_URLS = 50000;

export function urlsFromDir(dir, base, withLastmod = false) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(p); continue; }
      if (!e.name.endsWith('.html') || ['404.html', '500.html'].includes(e.name)) continue;
      const html = readFileSync(p, 'utf8');
      if (/<meta[^>]+name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;
      let path = '/' + relative(dir, p).split(sep).join('/');
      path = path.replace(/(^|\/)index\.html$/, '$1');
      out.push({ loc: base.replace(/\/$/, '') + path, lastmod: withLastmod ? statSync(p).mtime.toISOString().slice(0, 10) : undefined });
    }
  };
  walk(dir);
  return out;
}

export function urlsFromList(text, base) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => ({ loc: /^https?:\/\//.test(l) ? l : base.replace(/\/$/, '') + (l.startsWith('/') ? l : `/${l}`) }));
}

// Returns { 'sitemap.xml': '...', 'sitemap-1.xml': '...' } (index plus parts when there are more than 50,000 URLs).
export function buildSitemaps(entries, base, outName = 'sitemap.xml') {
  const host = new URL(base).host;
  const seen = new Set();
  const clean = entries.filter((e) => {
    const u = new URL(e.loc);
    if (u.host !== host || seen.has(u.href)) return false; // different host or duplicate: not allowed in this sitemap
    u.hash = ''; seen.add(u.href); e.loc = u.href;
    return true;
  });
  const xml = (list) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  if (clean.length <= MAX_URLS) return { [outName]: xml(clean) };
  const files = {};
  const parts = [];
  for (let i = 0; i * MAX_URLS < clean.length; i++) {
    const name = `${basename(outName, '.xml')}-${i + 1}.xml`;
    files[name] = xml(clean.slice(i * MAX_URLS, (i + 1) * MAX_URLS));
    parts.push(name);
  }
  files[outName] = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map((n) => `  <sitemap><loc>${esc(base.replace(/\/$/, '') + '/' + n)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const base = opt('--base');
  if (!base || !/^https:\/\//.test(base) || (!opt('--dir') && !opt('--urls'))) {
    console.error('Usage: node sitemap-gen.mjs --base https://example.com (--dir ./public | --urls urls.txt) [--out ./public/sitemap.xml] [--lastmod]');
    process.exit(2);
  }
  const entries = opt('--dir') ? urlsFromDir(opt('--dir'), base, args.includes('--lastmod')) : urlsFromList(readFileSync(opt('--urls'), 'utf8'), base);
  const out = opt('--out') || (opt('--dir') ? join(opt('--dir'), 'sitemap.xml') : 'sitemap.xml');
  const files = buildSitemaps(entries, base, basename(out));
  mkdirSync(dirname(out), { recursive: true });
  for (const [name, xml] of Object.entries(files)) writeFileSync(join(dirname(out), name), xml);
  console.log(`Wrote ${Object.keys(files).join(', ')} to ${dirname(out)} (${entries.length} URLs found). Next: add "Sitemap: ${base.replace(/\/$/, '')}/${basename(out)}" to robots.txt and submit it in Search Console.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
