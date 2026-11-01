// Runs the tester skill's scripts against a tiny fake API. Run: node --test
import { test, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const script = (name) => fileURLToPath(new URL(`../skills/tester-expert-v1/scripts/${name}`, import.meta.url));
let server, base, charges = 0;
const seenKeys = new Set();

before(async () => {
  server = http.createServer((req, res) => {
    const auth = req.headers.authorization;
    if (req.url === '/orders/1') { // properly protected, owned by A
      res.statusCode = auth === 'Bearer A' ? 200 : auth ? 404 : 401;
      return res.end();
    }
    if (req.url === '/orders/2') { res.statusCode = 200; return res.end(); } // leaks to everyone
    if (req.url === '/pay') { // charges once per idempotency key; without a key it charges every time (the bug)
      const key = req.headers['idempotency-key'];
      if (!key || !seenKeys.has(key)) { charges++; if (key) seenKeys.add(key); res.statusCode = 201; }
      else res.statusCode = 409;
      return res.end('{}');
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('race.mjs: same idempotency key charges once', async () => {
  charges = 0;
  const { stdout } = await run('node', [script('race.mjs'), `${base}/pay`, '8', '{}', 'k1']);
  const out = JSON.parse(stdout);
  assert.equal(out.sent, 8);
  assert.deepEqual(out.statuses, { 201: 1, 409: 7 });
  assert.equal(charges, 1);
});

test('race.mjs: no key exposes the double-charge bug', async () => {
  charges = 0;
  const { stdout } = await run('node', [script('race.mjs'), `${base}/pay`, '5']);
  assert.deepEqual(JSON.parse(stdout).statuses, { 201: 5 });
  assert.equal(charges, 5);
});

test('idor-check.mjs: flags the leaky object and exits 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'idor-'));
  const targets = join(dir, 'targets.txt');
  writeFileSync(targets, `# test targets\nGET ${base}/orders/1\n${base}/orders/2\nDELETE ${base}/orders/1\n`);
  const env = { ...process.env, OWNER: 'Authorization: Bearer A', OTHER: 'Authorization: Bearer B' };
  const err = await run('node', [script('idor-check.mjs'), targets], { env }).then(() => null, (e) => e);
  assert.ok(err, 'expected a non-zero exit');
  assert.equal(err.code, 1);
  assert.match(err.stdout, /orders\/2.*LEAK/);
  assert.match(err.stdout, /1 LEAK\(S\) FOUND/);
  assert.match(err.stdout, /DELETE .*orders\/1.*skipped/); // owner never sent an unsafe method
});
