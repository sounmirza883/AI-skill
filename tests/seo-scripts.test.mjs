// Tests for the seo-expert-v1 scripts against a tiny fake website with known problems. Run: node --test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { analyze, siteChecks } from '../skills/seo-expert-v1/scripts/seo-audit.mjs';
import { buildSitemaps, urlsFromDir, urlsFromList } from '../skills/seo-expert-v1/scripts/sitemap-gen.mjs';

const run = promisify(execFile);
const SCRIPT = (n) => fileURLToPath(new URL(`../skills/seo-expert-v1/scripts/${n}`, import.meta.url));
let server, base;

const GOOD = (origin) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Handmade ceramic mugs for everyday use | Fieldnote</title><meta name="description" content="Hand-glazed ceramic mugs that hold 350 ml, are dishwasher safe and ship in plastic-free packaging. Free returns within 30 days.">
<link rel="canonical" href="${origin}/"><meta property="og:title" content="Mugs"><meta property="og:image" content="${origin}/og.png"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Fieldnote"},{"@type":"WebSite","name":"Fieldnote"}]}</script></head>
<body><h1>Mugs</h1><h2>Why</h2><p>${'Words about mugs and their glaze and shape. '.repeat(12)}</p><img src="/a.jpg" alt="A mug"><a href="/about">About</a></body></html>`;
const BAD = `<!doctype html><html><head><script type="application/ld+json">{ not json }</script></head><body><a href="#/orders">Orders</a><a>Click</a><img src="/x.png"><p>Hi</p></body></html>`;
const dupPage = (t) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>${t}</title></head><body><h1>x</h1></body></html>`;

before(async () => {
  server = http.createServer((req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (code, body, type = 'text/html', extra = {}) => { res.writeHead(code, { 'Content-Type': type, ...extra }); res.end(body); };
    if (req.url === '/') return send(200, GOOD(origin));
    if (req.url === '/bad') return send(200, BAD, 'text/html', { 'X-Robots-Tag': 'noindex' });
    if (req.url === '/hop1') return send(301, '', 'text/plain', { Location: '/hop2' });
    if (req.url === '/hop2') return send(302, '', 'text/plain', { Location: '/' });
    if (req.url === '/dup1' || req.url === '/dup2') return send(200, dupPage('Same title on two pages'));
    if (req.url === '/robots.txt') return send(200, 'User-agent: *\nDisallow: /\n', 'text/plain');
    send(404, 'nope', 'text/plain');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const fetchAnalyze = async (path) => { const res = await fetch(base + path, { redirect: 'manual' }); return analyze({ url: base + path, finalUrl: base + path, status: res.status, headers: res.headers, body: await res.text() }); };
const codes = (r) => r.findings.map((f) => f.code);

test('audit: a good page has no errors or warnings and reports its schema types', async () => {
  const r = await fetchAnalyze('/');
  assert.deepEqual(r.findings.filter((f) => f.severity !== 'info'), []);
  assert.deepEqual(r.facts.schemaTypes, ['Organization', 'WebSite']);
});

test('audit: a bad page is flagged for every planted problem', async () => {
  const c = codes(await fetchAnalyze('/bad'));
  for (const code of ['TITLE_MISSING', 'DESC_MISSING', 'VIEWPORT_MISSING', 'CANONICAL_MISSING', 'H1_MISSING', 'JSONLD_INVALID', 'IMG_ALT_MISSING', 'HASH_ROUTES', 'LINKS_NOT_CRAWLABLE', 'THIN_RAW_HTML', 'X_ROBOTS_NOINDEX']) assert.ok(c.includes(code), `missing ${code} in ${c}`);
});

test('audit: redirect chains and fetch errors are reported', () => {
  const chain = analyze({ url: 'http://a/', finalUrl: 'http://a/z', status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: GOOD('http://a'), chain: [{ status: 301 }, { status: 302 }] });
  assert.ok(codes(chain).includes('REDIRECT_CHAIN'));
  assert.deepEqual(codes(analyze({ url: 'x', finalUrl: 'x', status: 0, error: 'boom' })), ['FETCH_FAILED']);
});

test('site checks: robots.txt that blocks everything and a missing sitemap are errors/warnings', async () => {
  const c = (await siteChecks(base)).map((f) => f.code);
  assert.ok(c.includes('ROBOTS_BLOCKS_ALL') && c.includes('SITEMAP_MISSING') && c.includes('ROBOTS_NO_SITEMAP'));
});

test('audit CLI: follows redirects, finds duplicate titles, exits 1 when there are errors', async () => {
  const err = await run('node', [SCRIPT('seo-audit.mjs'), `${base}/dup1`, `${base}/dup2`, `${base}/hop1`, `${base}/bad`, '--json']).then(() => null, (e) => e);
  assert.ok(err && err.code === 1, 'expected exit code 1');
  const out = JSON.parse(err.stdout);
  const byUrl = Object.fromEntries(out.pages.map((p) => [p.facts.url.replace(base, ''), p]));
  assert.ok(codes(byUrl['/dup1']).includes('TITLE_DUPLICATE') && codes(byUrl['/dup2']).includes('TITLE_DUPLICATE'));
  assert.equal(byUrl['/hop1'].facts.redirects, 2);
  assert.ok(codes(byUrl['/hop1']).includes('REDIRECT_CHAIN'));
});

test('sitemap: file folder becomes URLs, skipping noindex, 404 and hidden folders; lastmod only on request', () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  mkdirSync(join(dir, 'blog')); mkdirSync(join(dir, '.git'));
  writeFileSync(join(dir, 'index.html'), '<title>Home</title>');
  writeFileSync(join(dir, 'blog', 'index.html'), '<title>Blog</title>');
  writeFileSync(join(dir, 'about.html'), '<title>About</title>');
  writeFileSync(join(dir, 'thanks.html'), '<meta name="robots" content="noindex, follow">');
  writeFileSync(join(dir, '404.html'), '<title>Not found</title>');
  writeFileSync(join(dir, '.git', 'x.html'), 'x');
  const locs = urlsFromDir(dir, 'https://example.com').map((e) => e.loc).sort();
  assert.deepEqual(locs, ['https://example.com/', 'https://example.com/about.html', 'https://example.com/blog/']);
  assert.equal(urlsFromDir(dir, 'https://example.com')[0].lastmod, undefined);
  assert.match(urlsFromDir(dir, 'https://example.com', true)[0].lastmod, /^\d{4}-\d{2}-\d{2}$/);
  rmSync(dir, { recursive: true, force: true });
});

test('sitemap: escapes XML, drops duplicates, other hosts and fragments; splits above 50,000 URLs with an index', () => {
  const entries = urlsFromList('/a?x=1&y=2\n/a?x=1&y=2\n# comment\nhttps://other.com/z\n/p#frag\n/q', 'https://example.com');
  const one = buildSitemaps(entries, 'https://example.com')['sitemap.xml'];
  assert.match(one, /a\?x=1&amp;y=2/);
  assert.equal((one.match(/<loc>/g) || []).length, 3); // a, p, q
  assert.ok(!one.includes('other.com') && !one.includes('#frag'));
  const many = buildSitemaps(Array.from({ length: 50001 }, (_, i) => ({ loc: `https://example.com/p${i}` })), 'https://example.com');
  assert.deepEqual(Object.keys(many).sort(), ['sitemap-1.xml', 'sitemap-2.xml', 'sitemap.xml']);
  assert.match(many['sitemap.xml'], /<sitemapindex/);
  assert.equal((many['sitemap-2.xml'].match(/<loc>/g) || []).length, 1);
});

test('sitemap CLI writes the file next to --out and tells you the next steps', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  writeFileSync(join(dir, 'urls.txt'), '/\n/pricing\n');
  const { stdout } = await run('node', [SCRIPT('sitemap-gen.mjs'), '--base', 'https://example.com', '--urls', join(dir, 'urls.txt'), '--out', join(dir, 'out', 'sitemap.xml')]);
  assert.match(stdout, /submit it in Search Console/);
  assert.match(readFileSync(join(dir, 'out', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example\.com\/pricing<\/loc>/);
  rmSync(dir, { recursive: true, force: true });
});
