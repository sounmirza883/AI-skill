// Shared test helpers: start a throwaway server on a temp database, log in as a seeded test user.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, TEST_USERS } from '../seed.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export async function startServer(port, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shop-'));
  const db = join(dir, 'test.db');
  await seed(db);
  const proc = spawn(process.execPath, ['--no-warnings', 'server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_PATH: db, PAY_DELAY_MS: '30', ...env }, stdio: 'pipe' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { await fetch(`${base}/api/products`); break; } catch { if (i > 60) throw new Error('server did not start'); await new Promise((r) => setTimeout(r, 100)); }
  }
  return {
    base,
    async stop() {
      proc.kill();
      await new Promise((r) => (proc.exitCode === null ? proc.once('exit', r) : r())); // Windows keeps the DB file locked until exit
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

// Returns a fetch-like function that sends the session cookie, plus the raw cookie for reuse after logout.
export async function login(base, who) {
  const u = TEST_USERS.find((x) => x.name === who);
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }) });
  if (r.status !== 200) throw new Error(`login failed: ${r.status}`);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (path, opts = {}) => fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...opts.headers } });
  call.cookie = cookie;
  return call;
}
export const putQty = (c, id, quantity) => c(`/api/cart/items/${id}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
export const pay = (c, key, paymentMethod = 'pm_card_visa', extra = {}) =>
  c('/api/checkout', { method: 'POST', body: JSON.stringify({ paymentMethod, ...extra }), headers: key ? { 'Idempotency-Key': key } : {} });
export const json = async (r) => r.json();
