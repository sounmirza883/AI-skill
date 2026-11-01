// Runs the backend skill's scripts against a tiny project with planted problems. Run: node --test tests/*.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = (name) => fileURLToPath(new URL(`../skills/backend-expert-v1/scripts/${name}`, import.meta.url));
const load = (name) => import(pathToFileURL(dir(name)).href);
let bad, good;

const put = (root, rel, text) => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };

before(() => {
  bad = mkdtempSync(join(tmpdir(), 'be-bad-'));
  put(bad, 'public/app.js', `
    const KEY = 'sk_live_abcdefghij1234567890';
    fetch('/api/items');
    fetch('/api/missing', { method: 'POST' });
    items.forEach((i) => fetch(\`/api/items/\${i}\`, { method: 'DELETE' }));
    setInterval(() => fetch('/api/items'), 3000);
  `);
  put(bad, 'server.js', `
    app.get('/api/items', (req, res) => res.json(db.prepare('SELECT * FROM items').all()));
    app.delete('/api/items/:id', requireAuth, (req, res) => db.run('DELETE FROM items WHERE id = ?', req.params.id));
    app.get('/api/unused', (req, res) => res.end());
    const h = crypto.createHash('md5').update(password).digest('hex');
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Set-Cookie', 'sid=' + id);
    db.query(\`SELECT name FROM items WHERE name = '\${req.query.q}'\`);
  `);
  good = mkdtempSync(join(tmpdir(), 'be-good-'));
  put(good, 'public/app.js', "fetch('/api/items/' + 1);\nfetch(`/api/items/${id}`);");
  put(good, 'server.js', `
    const MAX_BODY = 10240; // 413 above this
    res.setHeader('Content-Security-Policy', "default-src 'self'"); // 429 + Retry-After on rate limit
    res.setHeader('Set-Cookie', 'sid=1; HttpOnly; SameSite=Lax');
    app.get('/api/items/:id', requireAuth, (req, res) => db.prepare('SELECT id, name FROM items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id));
  `);
});
after(() => { rmSync(bad, { recursive: true, force: true }); rmSync(good, { recursive: true, force: true }); });

test('call-map.mjs: finds missing routes, unused routes, pollers and loop calls', async () => {
  const { callMap } = await load('call-map.mjs');
  const codes = callMap(bad).findings.map((f) => `${f.code}:${f.msg.split(' ')[1] ?? ''}`);
  const all = callMap(bad).findings;
  assert.ok(all.some((f) => f.code === 'NO_ROUTE' && f.msg.includes('/api/missing')));
  assert.ok(all.some((f) => f.code === 'UNUSED_ROUTE' && f.msg.includes('/api/unused')));
  assert.ok(all.some((f) => f.code === 'POLLING' && f.msg.includes('3000')));
  assert.ok(all.some((f) => f.code === 'LOOP_CALL'));
  assert.ok(!all.some((f) => f.code === 'NO_ROUTE' && f.msg.includes('GET /api/items ')), codes.join());
});

test('call-map.mjs: a clean project has no errors and maps string-concat and template paths', async () => {
  const { callMap } = await load('call-map.mjs');
  const r = callMap(good);
  assert.equal(r.findings.filter((f) => f.sev === 'error').length, 0);
  assert.ok(r.calls.some((c) => c.route));
});

test('call-map.mjs: node:http-style routes on the demo shop are recognised', async () => {
  const { callMap } = await load('call-map.mjs');
  const r = callMap(fileURLToPath(new URL('../demo/shop', import.meta.url)));
  assert.ok(r.routes.some((x) => x.method === 'POST' && x.path === '/api/login'));
  assert.ok(r.routes.some((x) => x.method === 'GET' && x.path === '/api/orders/:p'));
  assert.equal(r.findings.filter((f) => f.code === 'NO_ROUTE').length, 0);
});

test('security-scan.mjs: flags the planted problems', async () => {
  const { scan } = await load('security-scan.mjs');
  const codes = new Set(scan(bad).map((f) => f.code));
  for (const c of ['SECRET_IN_CODE', 'WEAK_PASSWORD_HASH', 'CORS_WILDCARD_CREDENTIALS', 'COOKIE_NOT_HTTPONLY', 'SELECT_STAR', 'SQL_INTERPOLATION', 'OBJECT_ROUTE_NO_OWNER_CHECK', 'NO_RATE_LIMIT', 'NO_SECURITY_HEADERS']) {
    assert.ok(codes.has(c), `missing ${c}; got ${[...codes]}`);
  }
});

test('security-scan.mjs: clean project has no errors or warnings, and scan-ignore works', async () => {
  const { scan } = await load('security-scan.mjs');
  assert.deepEqual(scan(good).filter((f) => f.sev !== 'info'), []);
  const ign = mkdtempSync(join(tmpdir(), 'be-ign-'));
  put(ign, 'seed.js', "const user = { password: 'test-password-1' }; // scan-ignore: seeded test user");
  assert.equal(scan(ign).length, 0);
  rmSync(ign, { recursive: true, force: true });
});

test('security-scan.mjs CLI: exit code 1 on errors, 0 when clean', () => {
  const run = (d) => { try { execFileSync('node', [dir('security-scan.mjs'), d], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
  assert.equal(run(bad), 1);
  assert.equal(run(good), 0);
});

test('capacity.mjs: formulas match the documented example', async () => {
  const { estimate } = await load('capacity.mjs');
  const r = estimate({ dau: 1000, reqs: 200, hours: 9, peak: 3, resp: 50, db: 10, measured: 300, limits: { scan: 1 } });
  assert.equal(r.averageRps, 6.17);
  assert.equal(r.peakRps, 18.52);
  assert.equal(r.designRps, 55.56);
  assert.equal(r.suggestedPool, 10);
  assert.equal(r.headroom, 16.2);
  assert.deepEqual(r.rateLimits.scan, { perSecond: 2, perMinute: 120 });
  assert.throws(() => estimate({ dau: 0, reqs: 5 }), /--dau/);
});
