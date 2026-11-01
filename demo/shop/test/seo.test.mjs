// SEO fixes found by seo-expert-v1: real URLs, unique heads, visible content in the raw HTML, robots.txt, sitemap, real 404s.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(3107, { SITE_URL: 'https://shop.example.test' }); });
after(() => srv.stop());
const get = (p, opts) => fetch(srv.base + p, { redirect: 'manual', ...opts });
const title = (html) => html.match(/<title>([^<]*)<\/title>/)[1];

test('home: own title, canonical, one visible h1 and crawlable product links in the raw HTML', async () => {
  const r = await get('/');
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(title(html), /Fieldnote Goods/);
  assert.match(html, /<link rel="canonical" href="https:\/\/shop\.example\.test\/">/);
  assert.equal(html.match(/<h1[\s>]/g).length, 1);
  assert.ok(html.match(/<a href="\/products\/[a-z0-9-]+">/g).length >= 7);
  assert.doesNotMatch(html, /href="#\//, 'no hash routes left');
  assert.equal(r.headers.get('x-robots-tag'), null);
});

test('product page: unique title, Product + Offer JSON-LD that parses and matches the page', async () => {
  const html = await (await get('/products/limited-print')).text();
  assert.equal(title(html), 'Limited print – Fieldnote Goods');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const product = blocks.find((b) => b['@type'] === 'Product');
  assert.equal(product.name, 'Limited print');
  assert.equal(product.offers.priceCurrency, 'USD');
  assert.ok(html.includes(`$${product.offers.price}`), 'price in markup is the price on the page');
  assert.match(html, /<link rel="canonical" href="https:\/\/shop\.example\.test\/products\/limited-print">/);
});

test('private pages are crawlable but noindex (meta and header), and have no canonical', async () => {
  for (const p of ['/login', '/orders', '/checkout']) {
    const r = await get(p);
    const html = await r.text();
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get('x-robots-tag'), 'noindex', p);
    assert.match(html, /<meta name="robots" content="noindex">/, p);
    assert.doesNotMatch(html, /rel="canonical"/, p);
  }
});

test('unknown pages and products return a real 404; /index.html redirects to /', async () => {
  for (const p of ['/nope', '/products/does-not-exist', '/orders/extra']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.match(await r.text(), /noindex/, p);
  }
  const r = await get('/index.html');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/');
});

test('robots.txt blocks only the API and points to the sitemap; sitemap lists home and products only', async () => {
  const robots = await (await get('/robots.txt')).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/(orders|login|checkout)/, 'blocking would hide their noindex');
  assert.match(robots, /Sitemap: https:\/\/shop\.example\.test\/sitemap\.xml/);
  const r = await get('/sitemap.xml');
  assert.match(r.headers.get('content-type'), /xml/);
  const locs = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs[0], 'https://shop.example.test/');
  assert.equal(locs.length, 8);
  assert.ok(locs.every((u) => u === 'https://shop.example.test/' || /\/products\/[a-z0-9-]+$/.test(u)));
});

test('HEAD works and POST to a page is still refused', async () => {
  assert.equal((await get('/', { method: 'HEAD' })).status, 200);
  assert.equal((await get('/', { method: 'POST', headers: { Origin: srv.base } })).status, 405);
});
