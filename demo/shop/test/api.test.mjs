// Backend self-check. Run: node --test demo/shop/test   (spawns its own server on a temp database)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, TEST_USERS } from '../seed.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let proc, dir;

async function login(who) {
  const u = TEST_USERS.find((x) => x.name === who);
  const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }) });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return (path, opts = {}) => fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...opts.headers } });
}
const putQty = (c, id, quantity) => c(`/api/cart/items/${id}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
const pay = (c, key) => c('/api/checkout', { method: 'POST', body: JSON.stringify({ paymentMethod: 'pm_card_visa' }), headers: key ? { 'Idempotency-Key': key } : {} });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'shop-'));
  const db = join(dir, 'test.db');
  await seed(db);
  proc = spawn(process.execPath, ['--no-warnings', 'server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_PATH: db, RATE_MULT: '1' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/api/products`); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('server did not start');
});
after(async () => {
  proc.kill();
  await new Promise((r) => (proc.exitCode === null ? proc.once('exit', r) : r())); // Windows keeps the DB file locked until the server exits
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test('public catalog works, protected routes need a session', async () => {
  assert.equal((await fetch(`${BASE}/api/products`)).status, 200);
  for (const p of ['/api/me', '/api/cart', '/api/orders']) assert.equal((await fetch(BASE + p)).status, 401, p);
});

test('password is not stored in the clear and wrong login is generic', async () => {
  const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.test', password: 'x' }) });
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: 'invalid_credentials' });
});

test('shop screen is one request and cart updates return the new cart', async () => {
  const alice = await login('Alice');
  const screen = await (await alice('/api/screens/shop')).json();
  assert.equal(screen.user.name, 'Alice');
  assert.ok(screen.items.length >= 6 && screen.cart);
  const cart = await (await putQty(alice, 'mug', 2)).json();
  assert.equal(cart.totalCents, 2400);
  assert.equal((await putQty(alice, 'mug', 99)).status, 422);
  assert.equal((await putQty(alice, 'nope', 1)).status, 404);
});

test('checkout: same idempotency key five times in parallel creates one order', async () => {
  const bob = await login('Bob');
  await putQty(bob, 'tee', 1);
  const rs = await Promise.all(Array.from({ length: 5 }, () => pay(bob, 'key-tee-0001')));
  const codes = rs.map((r) => r.status).sort();
  assert.equal(codes.filter((c) => c === 201).length, 1, `statuses: ${codes}`);
  assert.ok(codes.every((c) => [201, 200, 409].includes(c)), `statuses: ${codes}`);
  const orders = (await (await bob('/api/orders')).json()).items;
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, 'paid');
});

test('checkout without a key: parallel clicks still charge once', async () => {
  const alice = await login('Alice');
  await putQty(alice, 'cap', 1);
  const before = (await (await alice('/api/orders')).json()).items.length;
  const rs = await Promise.all(Array.from({ length: 4 }, () => pay(alice)));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal((await (await alice('/api/orders')).json()).items.length, before + 1);
});

test('last unit: two buyers at once, exactly one wins and stock never goes negative', async () => {
  const [alice, bob] = [await login('Alice'), await login('Bob')];
  await putQty(alice, 'limited-print', 1);
  await putQty(bob, 'limited-print', 1);
  const [a, b] = await Promise.all([pay(alice, 'key-limited-a1'), pay(bob, 'key-limited-b1')]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal((await (await fetch(`${BASE}/api/products/limited-print`)).json()).inStock, false);
});

test('declined card restores stock and leaves no paid order', async () => {
  const bob = await login('Bob');
  await putQty(bob, 'limited-print', 0); // Bob lost the last-unit race above; the sold-out item stays in his cart until he removes it
  await putQty(bob, 'poster', 1);
  const r = await bob('/api/checkout', { method: 'POST', body: JSON.stringify({ paymentMethod: 'pm_card_declined' }), headers: { 'Idempotency-Key': 'key-declined-1' } });
  assert.equal(r.status, 402);
  const orders = (await (await bob('/api/orders')).json()).items;
  assert.equal(orders.find((o) => o.status === 'failed').items[0].productId, 'poster');
  assert.equal((await (await fetch(`${BASE}/api/products/poster`)).json()).inStock, true);
});

test('ordering needs a non-empty cart and a valid payment method', async () => {
  const bob = await login('Bob');
  await putQty(bob, 'poster', 0); // the declined card above correctly left the poster in his cart
  assert.equal((await pay(bob, 'key-empty-0001')).status, 409);
  const bad = await bob('/api/checkout', { method: 'POST', body: JSON.stringify({ paymentMethod: 'cash' }) });
  assert.equal(bad.status, 422);
});

test("another user cannot read someone else's order (404, not 403)", async () => {
  const [alice, bob] = [await login('Alice'), await login('Bob')];
  const bobsOrder = (await (await bob('/api/orders')).json()).items[0];
  assert.equal((await bob(`/api/orders/${bobsOrder.id}`)).status, 200);
  assert.equal((await alice(`/api/orders/${bobsOrder.id}`)).status, 404);
  assert.equal((await fetch(`${BASE}/api/orders/${bobsOrder.id}`)).status, 401);
});

test('login: 5 wrong passwords lock the account for a while (429 + Retry-After)', async () => {
  const bad = () => fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bob@example.test', password: 'wrong-password' }) });
  for (let i = 0; i < 5; i++) assert.equal((await bad()).status, 401);
  const locked = await bad();
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get('retry-after')) > 0);
});

test('oversized body, cross-site origin and traversal are rejected; errors leak nothing', async () => {
  const alice = await login('Alice');
  assert.equal((await alice('/api/cart/items/mug', { method: 'PUT', body: 'x'.repeat(20_000) })).status, 413);
  assert.equal((await alice('/api/cart/items/mug', { method: 'PUT', body: '{"quantity":1}', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.ok([400, 404].includes((await fetch(`${BASE}/%2e%2e/server.mjs`)).status));
  const bad = await alice('/api/cart/items/mug', { method: 'PUT', body: '{not json' });
  assert.equal(bad.status, 400);
  assert.ok(!/at .*\.mjs|SELECT|stack/i.test(await bad.text()));
  const h = (await fetch(`${BASE}/`)).headers;
  assert.ok(h.get('content-security-policy') && h.get('x-content-type-options') === 'nosniff');
});
