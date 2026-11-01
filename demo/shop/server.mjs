// Demo shop: API + static files, zero dependencies (node:http, node:sqlite, node:crypto).
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, hashPassword, verifyPassword } from './db.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(HERE, 'public');
const PORT = Number(process.env.PORT || 3000);
const MULT = Number(process.env.RATE_MULT || 1); // raise on staging to load-test with a few test accounts
const SECURE = process.env.COOKIE_SECURE === '1'; // set behind HTTPS
const COOKIE = SECURE ? '__Host-sid' : 'sid';
const SESSION_MS = 8 * 3600_000;
const db = openDb(process.env.DB_PATH || join(HERE, 'shop.db'));
const DUMMY_HASH = await hashPassword('dummy-password-for-timing'); // unknown emails cost the same time as wrong passwords

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

// ---------- rate limiting (in memory; shortcut: one instance only — use Redis when you run more) ----------
const log = new Map();
const recent = (key, win) => {
  const now = Date.now();
  const a = (log.get(key) || []).filter((t) => now - t < win);
  log.set(key, a);
  return a;
};
const hit = (key, win) => recent(key, win).push(Date.now());
function limited(key, max, win) { // counts this call; returns Retry-After seconds when over the limit
  const a = recent(key, win);
  if (a.length >= Math.ceil(max * MULT)) return Math.max(1, Math.ceil((a[0] + win - Date.now()) / 1000));
  a.push(Date.now());
  return 0;
}
setInterval(() => { for (const k of log.keys()) if (!recent(k, 15 * 60_000).length) log.delete(k); }, 60_000).unref();
const LIMITS = { read: [300, 60_000], write: [60, 60_000], checkout: [10, 60_000] };

// ---------- queries ----------
const q = {
  userByEmail: db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?'),
  sessionUser: db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'),
  addSession: db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  productsFirst: db.prepare('SELECT id, name, description, price_cents, stock FROM products ORDER BY id LIMIT ?'),
  productsAfter: db.prepare('SELECT id, name, description, price_cents, stock FROM products WHERE id > ? ORDER BY id LIMIT ?'),
  product: db.prepare('SELECT id, name, description, price_cents, stock FROM products WHERE id = ?'),
  cart: db.prepare('SELECT c.product_id, c.qty, p.name, p.price_cents, p.stock FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.user_id = ? ORDER BY p.id'),
  setQty: db.prepare('INSERT INTO cart_items(user_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, product_id) DO UPDATE SET qty = excluded.qty'),
  delItem: db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?'),
  clearCart: db.prepare('DELETE FROM cart_items WHERE user_id = ?'),
  takeStock: db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?'), // atomic: never goes negative
  giveStock: db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?'),
  restoreCart: db.prepare('INSERT INTO cart_items(user_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, product_id) DO UPDATE SET qty = MIN(20, qty + excluded.qty)'),
  addOrder: db.prepare('INSERT INTO orders(id, user_id, idempotency_key, status, total_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  addOrderItem: db.prepare('INSERT INTO order_items(order_id, product_id, name, unit_cents, qty) VALUES (?, ?, ?, ?, ?)'),
  setStatus: db.prepare('UPDATE orders SET status = ? WHERE id = ? AND status = \'pending\''),
  addPayment: db.prepare('INSERT INTO payments(order_id, amount_cents, ref) VALUES (?, ?, ?)'),
  orderByKey: db.prepare('SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?'),
  orderOwned: db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?'), // owner check lives in the query
  orders: db.prepare('SELECT * FROM orders WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC, id DESC LIMIT ?'),
};

function tx(fn) { // synchronous on purpose: no await inside, so no network I/O while a transaction is open
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw e; }
}

// ---------- helpers ----------
const productDto = (p) => ({ id: p.id, name: p.name, description: p.description, priceCents: p.price_cents, inStock: p.stock > 0 });
function cartOf(uid) {
  const items = q.cart.all(uid).map((r) => ({
    productId: r.product_id, name: r.name, unitCents: r.price_cents, qty: r.qty, lineCents: r.price_cents * r.qty, available: r.stock,
  }));
  return { items, totalCents: items.reduce((s, i) => s + i.lineCents, 0) };
}
function ordersWithItems(rows) {
  if (!rows.length) return [];
  const marks = rows.map(() => '?').join(',');
  const items = db.prepare(`SELECT order_id, product_id, name, unit_cents, qty FROM order_items WHERE order_id IN (${marks})`).all(...rows.map((r) => r.id));
  return rows.map((o) => ({
    id: o.id, status: o.status, totalCents: o.total_cents, createdAt: o.created_at,
    items: items.filter((i) => i.order_id === o.id).map((i) => ({ productId: i.product_id, name: i.name, unitCents: i.unit_cents, qty: i.qty })),
  }));
}
function listProducts(limit, cursor) {
  const rows = cursor ? q.productsAfter.all(cursor, limit + 1) : q.productsFirst.all(limit + 1);
  const page = rows.slice(0, limit);
  return { items: page.map(productDto), nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
const intParam = (v, def, min, max) => {
  if (v == null) return def;
  if (!/^\d{1,6}$/.test(v) || Number(v) < min || Number(v) > max) throw new HttpError(422, 'invalid_parameter');
  return Number(v);
};
const PRODUCT_ID = /^[a-z0-9-]{1,40}$/;

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 10_240) throw new HttpError(413, 'body_too_large');
    chunks.push(c);
  }
  if (!size) return {};
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'invalid_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_json');
  return body;
}

function getUser(req) {
  const m = new RegExp(`(?:^|; )${COOKIE}=([\\w-]{20,100})`).exec(req.headers.cookie || '');
  return m ? q.sessionUser.get(sha(m[1]), Date.now()) : null;
}
function requireUser(user) { if (!user) throw new HttpError(401, 'unauthorized'); return user; }

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}

// ---------- checkout ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function chargeStub(paymentMethod) { // stands in for the payment provider; runs OUTSIDE any DB transaction
  await sleep(Number(process.env.PAY_DELAY_MS ?? 80));
  return paymentMethod !== 'pm_card_declined';
}

function replay(prev) {
  if (prev.status === 'paid') return [200, { order: ordersWithItems([prev])[0], replayed: true }];
  if (prev.status === 'pending') throw new HttpError(409, 'checkout_in_progress', { retryAfter: 2 });
  throw new HttpError(402, 'payment_declined', { orderId: prev.id });
}

async function checkout(user, keyHeader, body) {
  const pm = body.paymentMethod;
  if (typeof pm !== 'string' || !/^pm_card_[a-z_]{1,30}$/.test(pm)) throw new HttpError(422, 'invalid_payment_method');
  if (keyHeader != null && !/^[\w-]{8,64}$/.test(keyHeader)) throw new HttpError(400, 'invalid_idempotency_key');
  const key = keyHeader || `auto-${crypto.randomUUID()}`; // no key: the cart being consumed atomically still blocks a double charge

  const prev = q.orderByKey.get(user.id, key);
  if (prev) return replay(prev);

  const order = tx(() => {
    const items = q.cart.all(user.id);
    if (!items.length) throw new HttpError(409, 'cart_empty');
    let total = 0;
    for (const it of items) {
      if (q.takeStock.run(it.qty, it.product_id, it.qty).changes === 0) throw new HttpError(409, 'out_of_stock', { productId: it.product_id });
      total += it.price_cents * it.qty;
    }
    const o = { id: newId('ord'), totalCents: total, createdAt: new Date().toISOString(), items };
    q.addOrder.run(o.id, user.id, key, 'pending', total, o.createdAt);
    for (const it of items) q.addOrderItem.run(o.id, it.product_id, it.name, it.price_cents, it.qty);
    q.clearCart.run(user.id);
    return o;
  });

  // shortcut: a crash right here leaves a 'pending' order holding stock; add a reaper job before production.
  if (await chargeStub(pm)) {
    tx(() => { q.setStatus.run('paid', order.id); q.addPayment.run(order.id, order.totalCents, `stub_${order.id}`); });
    return [201, { order: ordersWithItems([q.orderOwned.get(order.id, user.id)])[0] }];
  }
  tx(() => { // a declined card undoes everything: stock goes back and the buyer keeps their cart to retry
    q.setStatus.run('failed', order.id);
    for (const it of order.items) { q.giveStock.run(it.qty, it.product_id); q.restoreCart.run(user.id, it.product_id, it.qty); }
  });
  throw new HttpError(402, 'payment_declined', { orderId: order.id });
}

// ---------- routes ----------
async function api(req, res, url) {
  const path = url.pathname, method = req.method, ip = req.socket.remoteAddress;
  const unsafe = method !== 'GET' && method !== 'HEAD';
  if (unsafe) { // CSRF defence in depth on top of SameSite=Lax
    const origin = req.headers.origin;
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* "null" (sandboxed frames) or garbage: treated as foreign */ }
      if (host !== req.headers.host) throw new HttpError(403, 'bad_origin');
    }
  }
  const wait0 = limited(`edge:${ip}`, 1000, 60_000);
  if (wait0) throw new HttpError(429, 'rate_limited', { retryAfter: wait0 });
  const user = getUser(req);

  const rateClass = path === '/api/login' ? null : path === '/api/checkout' ? 'checkout' : unsafe ? 'write' : 'read';
  if (rateClass) {
    const [max, win] = LIMITS[rateClass];
    const wait = limited(`${rateClass}:${user ? `u${user.id}` : ip}`, max, win);
    if (wait) throw new HttpError(429, 'rate_limited', { retryAfter: wait });
  }

  let m;
  if (path === '/api/login' && method === 'POST') {
    const wait = limited(`login-ip:${ip}`, 20, 60_000);
    if (wait) throw new HttpError(429, 'rate_limited', { retryAfter: wait });
    const { email, password } = await readJson(req);
    if (typeof email !== 'string' || typeof password !== 'string' || !email || email.length > 254 || !password || password.length > 200) {
      throw new HttpError(422, 'invalid_credentials_format');
    }
    const failKey = `login-fail:${email.toLowerCase()}`;
    const failures = recent(failKey, 15 * 60_000);
    if (failures.length >= Math.ceil(5 * MULT)) throw new HttpError(429, 'rate_limited', { retryAfter: Math.max(1, Math.ceil((failures[0] + 15 * 60_000 - Date.now()) / 1000)) });
    const u = q.userByEmail.get(email);
    const ok = await verifyPassword(password, u ? u.password_hash : DUMMY_HASH);
    if (!u || !ok) { hit(failKey, 15 * 60_000); throw new HttpError(401, 'invalid_credentials'); } // same answer for both cases
    log.delete(failKey);
    q.purgeSessions.run(Date.now());
    const token = crypto.randomBytes(32).toString('base64url'); // fresh session id on every login (no fixation)
    q.addSession.run(sha(token), u.id, Date.now() + SESSION_MS);
    return send(res, 200, { user: { id: u.id, email: u.email, name: u.name } }, {
      'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${SECURE ? '; Secure' : ''}`,
    });
  }
  if (path === '/api/logout' && method === 'POST') {
    const c = new RegExp(`(?:^|; )${COOKIE}=([\\w-]+)`).exec(req.headers.cookie || '');
    if (c) q.delSession.run(sha(c[1]));
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? '; Secure' : ''}` });
  }
  if (path === '/api/me' && method === 'GET') return send(res, 200, { user: requireUser(user) });

  // One request renders the shop front: user + first page of products + cart.
  if (path === '/api/screens/shop' && method === 'GET') {
    return send(res, 200, { user, ...listProducts(24, null), cart: user ? cartOf(user.id) : { items: [], totalCents: 0 } });
  }
  if (path === '/api/products' && method === 'GET') {
    const cursor = url.searchParams.get('cursor');
    if (cursor && !PRODUCT_ID.test(cursor)) throw new HttpError(422, 'invalid_parameter');
    return send(res, 200, listProducts(intParam(url.searchParams.get('limit'), 24, 1, 100), cursor));
  }
  if ((m = /^\/api\/products\/([a-z0-9-]{1,40})$/.exec(path)) && method === 'GET') {
    const p = q.product.get(m[1]);
    if (!p) throw new HttpError(404, 'not_found');
    return send(res, 200, productDto(p));
  }

  if (path === '/api/cart' && method === 'GET') return send(res, 200, cartOf(requireUser(user).id));
  if ((m = /^\/api\/cart\/items\/([a-z0-9-]{1,40})$/.exec(path)) && (method === 'PUT' || method === 'DELETE')) {
    requireUser(user);
    let qty = 0;
    if (method === 'PUT') { // sets an absolute quantity, so a double click sends the same value twice and is harmless
      const body = await readJson(req);
      if (!Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 20) throw new HttpError(422, 'invalid_quantity');
      qty = body.quantity;
    }
    if (qty === 0) q.delItem.run(user.id, m[1]);
    else {
      const p = q.product.get(m[1]);
      if (!p) throw new HttpError(404, 'not_found');
      if (qty > p.stock) throw new HttpError(409, 'not_enough_stock', { available: p.stock });
      q.setQty.run(user.id, m[1], qty);
    }
    return send(res, 200, cartOf(user.id));
  }

  if (path === '/api/checkout' && method === 'POST') {
    const [status, body] = await checkout(requireUser(user), req.headers['idempotency-key'], await readJson(req));
    return send(res, status, body);
  }
  if (path === '/api/orders' && method === 'GET') {
    requireUser(user);
    const since = url.searchParams.get('since') || '';
    if (since && Number.isNaN(Date.parse(since))) throw new HttpError(422, 'invalid_parameter');
    const rows = q.orders.all(user.id, since ? new Date(since).toISOString() : '', intParam(url.searchParams.get('limit'), 25, 1, 100));
    return send(res, 200, { items: ordersWithItems(rows) });
  }
  if ((m = /^\/api\/orders\/(ord_[0-9a-f]{16})$/.exec(path)) && method === 'GET') {
    const row = q.orderOwned.get(m[1], requireUser(user).id);
    if (!row) throw new HttpError(404, 'not_found'); // 404 for "not yours" too: hides that the order exists
    return send(res, 200, ordersWithItems([row])[0]);
  }
  throw new HttpError(404, 'not_found');
}

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed');
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { throw new HttpError(400, 'bad_path'); }
  if (rel.includes('\0')) throw new HttpError(400, 'bad_path');
  const file = resolve(PUBLIC, `.${rel === '/' ? '/index.html' : rel}`);
  if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) throw new HttpError(404, 'not_found');
  const type = TYPES[extname(file)];
  if (!type) throw new HttpError(404, 'not_found');
  let data;
  try { data = await readFile(file); } catch { throw new HttpError(404, 'not_found'); }
  // shortcut: no fingerprinted file names, so everything revalidates (no-cache); switch to hashed names + long max-age for production
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : data);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e instanceof HttpError) {
      const { retryAfter, ...extra } = e.extra;
      return send(res, e.status, { error: e.code, ...extra }, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
    }
    const id = crypto.randomUUID();
    console.error(`[${id}]`, e); // details stay in the server log; the client only gets the id
    send(res, 500, { error: 'internal_error', requestId: id });
  }
});
server.requestTimeout = 15_000;
server.listen(PORT, () => console.log(`Shop on http://localhost:${PORT}`));
