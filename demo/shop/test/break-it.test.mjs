// Break-it tests (tester-expert-v1): what users and attackers do that the happy path never covers.
// Run: node --test test/break-it.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, login, putQty, pay, json } from './helpers.mjs';

const P = 4000 + Math.floor(Math.random() * 40) * 2;
let main, strict; // main: generous limits so tests don't trip them; strict: production limits for the rate-limit tests
before(async () => { [main, strict] = await Promise.all([startServer(P, { RATE_MULT: '5' }), startServer(P + 1, { RATE_MULT: '1' })]); });
after(async () => { await Promise.all([main.stop(), strict.stop()]); });

const orders = async (c) => (await json(await c('/api/orders'))).items;

// ---------- money ----------
test('declined card: stock comes back AND the items stay in the cart so the buyer can retry', async () => {
  const bob = await login(main.base, 'Bob');
  await putQty(bob, 'poster', 2);
  const r = await pay(bob, 'declined-key-0001', 'pm_card_declined');
  assert.equal(r.status, 402);
  assert.equal((await json(await fetch(`${main.base}/api/products/poster`))).inStock, true);
  const cart = await json(await bob('/api/cart'));
  assert.equal(cart.items.length, 1, 'cart was emptied by a failed payment');
  assert.equal(cart.items[0].qty, 2);
});

test('after a decline, paying again with a new key and a good card works', async () => {
  const bob = await login(main.base, 'Bob');
  const r = await pay(bob, 'retry-key-00002');
  assert.equal(r.status, 201);
  assert.equal((await orders(bob)).filter((o) => o.status === 'paid').length, 1);
});

test('client-sent prices and totals are ignored', async () => {
  const alice = await login(main.base, 'Alice');
  const put = await alice('/api/cart/items/mug', { method: 'PUT', body: JSON.stringify({ quantity: 1, price: 1, unitCents: 1, priceCents: 1 }) });
  assert.equal((await json(put)).totalCents, 1200);
  const r = await pay(alice, 'tamper-key-0001', 'pm_card_visa', { totalCents: 1, price: 1, status: 'paid', userId: 2 });
  assert.equal(r.status, 201);
  const { order } = await json(r);
  assert.equal(order.totalCents, 1200);
});

test('Back/refresh after paying: same key replays the order, no second order', async () => {
  const alice = await login(main.base, 'Alice');
  const before = (await orders(alice)).length;
  const again = await pay(alice, 'tamper-key-0001');
  assert.equal(again.status, 200);
  assert.equal((await json(again)).replayed, true);
  assert.equal((await orders(alice)).length, before);
});

test('paying again with a NEW key and an empty cart is refused', async () => {
  const alice = await login(main.base, 'Alice');
  const before = (await orders(alice)).length;
  assert.equal((await pay(alice, 'brand-new-key-01')).status, 409);
  assert.equal((await orders(alice)).length, before);
});

test('idempotency keys belong to one user: the same key from two users makes two orders', async () => {
  const [alice, bob] = [await login(main.base, 'Alice'), await login(main.base, 'Bob')];
  await putQty(alice, 'notebook', 1); await putQty(bob, 'notebook', 1);
  const [a, b] = await Promise.all([pay(alice, 'shared-key-0001'), pay(bob, 'shared-key-0001')]);
  assert.deepEqual([a.status, b.status], [201, 201]);
  assert.notEqual((await json(a)).order.id, (await json(b)).order.id);
});

// ---------- sessions ----------
test('a cookie is dead after logout (stolen or second-tab cookie)', async () => {
  const alice = await login(main.base, 'Alice');
  assert.equal((await alice('/api/me')).status, 200);
  assert.equal((await alice('/api/logout', { method: 'POST' })).status, 200);
  assert.equal((await alice('/api/me')).status, 401);
  assert.equal((await putQty(alice, 'mug', 1)).status, 401);
});

test('forged, truncated and oversized cookies are just anonymous', async () => {
  for (const cookie of ['sid=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', `sid=${'a'.repeat(300)}`, 'sid=', 'sid=../../etc', 'sid=%00%00', '; ; sid']) {
    const r = await fetch(`${main.base}/api/me`, { headers: { Cookie: cookie } });
    assert.equal(r.status, 401, cookie);
  }
});

// ---------- input and tampering ----------
test('bad quantities are rejected with 422 and never change the cart', async () => {
  const alice = await login(main.base, 'Alice');
  for (const q of [-1, 0.5, '2', null, 21, 1e9, true, [], {}]) {
    assert.equal((await putQty(alice, 'cap', q)).status, 422, JSON.stringify(q));
  }
  assert.equal((await alice('/api/cart/items/cap', { method: 'PUT', body: '{}' })).status, 422);
  assert.equal((await json(await alice('/api/cart'))).items.length, 0);
});

test('odd list parameters are validated', async () => {
  const alice = await login(main.base, 'Alice');
  for (const qs of ['limit=0', 'limit=101', 'limit=abc', 'limit=-1', 'limit=1e3', 'since=garbage']) assert.equal((await alice(`/api/orders?${qs}`)).status, 422, qs);
  assert.equal((await alice('/api/orders?limit=100')).status, 200);
  for (const qs of ['limit=0', 'limit=999999', "cursor=' OR 1=1--"]) assert.equal((await fetch(`${main.base}/api/products?${qs}`)).status, 422, qs);
});

test('injection-style ids give 404 or 422, never a 500 or a leak', async () => {
  const alice = await login(main.base, 'Alice');
  for (const id of ["' OR 1=1--", '../x', '%00', 'MUG', 'a'.repeat(300), '<script>alert(1)</script>']) {
    const e = encodeURIComponent(id);
    for (const r of [await fetch(`${main.base}/api/products/${e}`), await putQty(alice, e, 1), await alice(`/api/orders/${e}`)]) {
      assert.ok([404, 422].includes(r.status), `${id} -> ${r.status}`);
    }
  }
});

test('cross-site requests: foreign, malformed and "null" Origin headers get 403, never a 500', async () => {
  const alice = await login(main.base, 'Alice');
  for (const origin of ['https://evil.example', 'null', 'not a url', 'http://']) {
    const r = await alice('/api/cart/items/mug', { method: 'PUT', body: '{"quantity":1}', headers: { Origin: origin } });
    assert.equal(r.status, 403, `Origin: ${origin} -> ${r.status}`);
  }
});

test('static server never leaks files outside public/', async () => {
  for (const p of ['/..%5Cserver.mjs', '/%2e%2e/server.mjs', '/..%2fdb.mjs', '/%2e%2e%2f%2e%2e%2fetc%2fpasswd', '/.git/config', '/BACKEND.md', '/shop.db', '/seed.mjs', '/index.html%00.png', '//server.mjs']) {
    const r = await fetch(main.base + p);
    const body = await r.text();
    // "//server.mjs" parses as a protocol-relative URL whose path is "/", so the app shell (200) is correct; source code never is.
    assert.ok([400, 404].includes(r.status) || (r.status === 200 && /<title>Fieldnote Goods[^<]*<\/title>/.test(body)), `${p} -> ${r.status}`);
    assert.ok(!/import .* from|DatabaseSync/.test(body), `${p} leaked source`);
  }
});

// ---------- limits (production limits) ----------
test('read limit: 320 quick GETs trigger 429 with Retry-After, and the server stays healthy', async () => {
  const alice = await login(strict.base, 'Alice');
  const rs = await Promise.all(Array.from({ length: 320 }, () => alice('/api/cart')));
  const limited = rs.filter((r) => r.status === 429);
  assert.ok(limited.length >= 1 && rs.every((r) => [200, 429].includes(r.status)), 'expected only 200 and 429');
  assert.ok(Number(limited[0].headers.get('retry-after')) >= 1);
});

test('login lockout is per account, ignores letter case, and does not lock other users', async () => {
  const wrong = (email) => fetch(`${strict.base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'not-the-password' }) });
  for (let i = 0; i < 5; i++) await wrong(i % 2 ? 'BOB@example.test' : 'bob@example.test');
  assert.equal((await wrong('Bob@Example.Test')).status, 429, 'case variant escaped the lockout');
  assert.equal((await login(strict.base, 'Alice'))('/api/me') instanceof Promise, true); // Alice can still log in
});

// ---------- deploys ----------
test('static files are never served with a long cache lifetime (users would run stale code after a deploy)', async () => {
  for (const p of ['/', '/app.js', '/styles.css']) {
    const cc = (await fetch(main.base + p)).headers.get('cache-control') || '';
    assert.ok(/no-cache|no-store|max-age=0/.test(cc), `${p}: ${cc}`);
  }
});
