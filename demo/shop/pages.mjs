// Server-rendered HTML for crawlers and first paint: every URL gets its own head, a visible <h1> and real <a href> links.
// The client app (public/app.js) takes over after load; private pages are crawlable but noindex (seo-expert-v1).
import { readFile } from 'node:fs/promises';

const BRAND = 'Fieldnote Goods';
const H1 = 'Seven good things for everyday use'; // same copy as shopView() in public/app.js
const LEDE = 'A mug, a cap, a notebook that lies flat. Log in with a demo account to try the whole path, from cart to order history.';
const PRIVATE = { '/login': 'Log in', '/orders': 'Your orders', '/checkout': 'Checkout' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = (c) => `$${(c / 100).toFixed(2)}`;
const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`; // data block, not run, so the CSP allows it

export function createPages({ templatePath, site, getProduct, listProducts }) {
  const head = ({ title, description, path, noindex, jsonld = [] }) => [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${site}${path}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:type" content="${path.startsWith('/products/') ? 'product' : 'website'}">`,
    `<meta property="og:url" content="${site}${path}">`,
    ...jsonld.map(ld),
  ].join('\n  ');

  const html = async (status, meta, main) => {
    const tpl = await readFile(templatePath, 'utf8'); // shortcut: read per request so edits show without restart; cache it in production
    return { status, type: 'text/html; charset=utf-8', noindex: meta.noindex, body: tpl.replace('<!--SEO-->', head(meta)).replace('<!--MAIN-->', main) };
  };
  const notFound = () => html(404, { title: `Page not found – ${BRAND}`, description: 'This page does not exist.', path: '/404', noindex: true },
    '<section class="page narrow"><h1>Page not found</h1><a class="btn btn--primary" href="/">Back to the shop</a></section>');

  return async function page(pathname) {
    if (pathname === '/index.html') return { status: 301, location: '/' };
    if (pathname === '/robots.txt') {
      // private pages stay crawlable so Google can read their noindex; only the API is blocked
      return { status: 200, type: 'text/plain; charset=utf-8', body: `User-agent: *\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n` };
    }
    if (pathname === '/sitemap.xml') {
      // shortcut: first 100 products, no <lastmod> (no reliable change date yet); paginate with the cursor past 100
      const urls = ['/', ...listProducts(100, null).items.map((p) => `/products/${p.id}`)];
      return { status: 200, type: 'application/xml; charset=utf-8',
        body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(site + u)}</loc></url>`).join('\n')}\n</urlset>\n` };
    }
    if (pathname === '/') {
      const { items } = listProducts(24, null);
      return html(200, {
        title: `${BRAND} – everyday objects, made to last`,
        description: 'Fieldnote Goods: a mug, a cap, a notebook that lies flat and four more everyday objects. A demo shop: payments are simulated.',
        path: '/',
        jsonld: [{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: `${site}/` }, { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: `${site}/` }],
      }, `<section class="page"><h1>${H1}</h1><p class="lede">${esc(LEDE)}</p><h2>Products</h2><ul class="ssr-list">${
        items.map((p) => `<li><a href="/products/${p.id}">${esc(p.name)}</a> · ${money(p.priceCents)}${p.inStock ? '' : ' · sold out'}<br>${esc(p.description)}</li>`).join('')}</ul></section>`);
    }
    if (PRIVATE[pathname]) {
      return html(200, { title: `${PRIVATE[pathname]} – ${BRAND}`, description: `${PRIVATE[pathname]} at ${BRAND}.`, path: pathname, noindex: true },
        `<section class="page narrow"><h1>${PRIVATE[pathname]}</h1><noscript><p>This page needs JavaScript.</p></noscript></section>`);
    }
    const m = /^\/products\/([a-z0-9-]{1,40})$/.exec(pathname);
    if (m) {
      const p = getProduct(m[1]);
      if (!p) return notFound();
      return html(200, {
        title: `${p.name} – ${BRAND}`, description: `${p.description} ${money(p.priceCents)} at ${BRAND}.`, path: pathname,
        jsonld: [
          { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, url: `${site}${pathname}`,
            offers: { '@type': 'Offer', price: (p.priceCents / 100).toFixed(2), priceCurrency: 'USD', availability: `https://schema.org/${p.inStock ? 'InStock' : 'OutOfStock'}`, url: `${site}${pathname}` } },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Shop', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: p.name, item: `${site}${pathname}` }] },
        ],
      }, `<section class="page narrow product"><nav aria-label="Breadcrumb"><a href="/">Shop</a> / ${esc(p.name)}</nav><h1>${esc(p.name)}</h1><p class="lede">${esc(p.description)}</p><p class="price">${money(p.priceCents)}</p>${
        p.inStock ? `<button class="btn btn--primary" type="button" data-add="${p.id}">Add to cart</button>` : '<button class="btn btn--primary" type="button" disabled>Sold out</button>'}</section>`);
    }
    if (!/\.\w+$/.test(pathname)) return notFound(); // paths that look like files fall through to the static server
    return null;
  };
}
