// Load test with virtual shoppers (tester-expert-v1). Zero dependencies.
// Starts its OWN copy of the shop on port 3100 (temp database, raised rate limits, simulated payments) and never touches port 3000.
// Usage: node load/load.mjs [--steady-only]      Results: reports/load-test.json
import http from 'node:http';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { seed } from '../seed.mjs';
import { openDb, hashPassword } from '../db.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3100, USERS = 40, MAX_INFLIGHT = 1500, TIMEOUT_MS = 5000;
const STEADY_ONLY = process.argv.includes('--steady-only');
const RAMP_ONLY = process.argv.includes('--ramp-only'); // re-runs just the breakpoint ramp and merges it into the existing results file
const PRODUCTS = ['mug', 'tee', 'cap', 'bottle', 'notebook', 'poster'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const isError = (r) => r.status === 0 || r.status >= 500;

// ---------- setup: temp DB, 40 test shoppers, plenty of stock, own server ----------
const dir = mkdtempSync(join(tmpdir(), 'shop-load-'));
const dbPath = join(dir, 'load.db');
await seed(dbPath);
const db = openDb(dbPath);
const hash = await hashPassword('load-test-password-1'); // one hash reused: setup stays fast, logins still do real Argon2 work
for (let i = 1; i <= USERS; i++) db.prepare('INSERT INTO users(email, name, password_hash) VALUES (?, ?, ?)').run(`load${i}@example.test`, `Load ${i}`, hash);
db.exec('UPDATE products SET stock = 1000000000');
db.close();
const server = spawn(process.execPath, ['--no-warnings', 'server.mjs'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath, RATE_MULT: '100000', PAY_DELAY_MS: '80' } });
let serverStderr = '';
server.stderr.on('data', (d) => { if (serverStderr.length < 4000) serverStderr += d; }); // server errors (stack traces) during the run
let serverExited = false;
server.on('exit', () => { serverExited = true; });

// ---------- HTTP client ----------
const agent = new http.Agent({ keepAlive: true, maxSockets: 600 });
const records = [];
let START = performance.now(), inflight = 0, dropped = 0;
function call(name, method, path, user, body, headers = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const data = body ? JSON.stringify(body) : null;
    let finished = false;
    const done = (status, err) => { if (finished) return; finished = true; const r = { name, status, err, ms: performance.now() - t0, t: performance.now() - START }; records.push(r); resolve(r); };
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, agent, timeout: TIMEOUT_MS,
      headers: { ...(user ? { Cookie: user.cookie } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } },
    (res) => { res.resume(); res.on('end', () => done(res.statusCode)); });
    req.on('timeout', () => { req.destroy(); done(0, 'timeout'); });
    req.on('error', (e) => done(0, e.code || e.message));
    if (data) req.write(data);
    req.end();
  });
}
for (let i = 0; ; i++) { // wait for the server
  const r = await call('ready', 'GET', '/api/products', null);
  if (r.status === 200) break;
  if (i > 100) throw new Error('server did not start');
  await new Promise((r2) => setTimeout(r2, 100));
}
const users = [];
for (let i = 1; i <= USERS; i += 4) { // 4 at a time: logins are deliberately expensive
  await Promise.all(Array.from({ length: Math.min(4, USERS - i + 1) }, async (_, k) => {
    const body = JSON.stringify({ email: `load${i + k}@example.test`, password: 'load-test-password-1' });
    const cookie = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/api/login', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => { res.resume(); res.on('end', () => (res.statusCode === 200 ? resolve(res.headers['set-cookie'][0].split(';')[0]) : reject(new Error(`login ${res.statusCode}`)))); });
      req.on('error', reject); req.end(body);
    });
    users.push({ cookie });
  }));
}
records.length = 0;

// ---------- what a shopper does ----------
const ACTIONS = {
  front: (u) => call('screen', 'GET', '/api/screens/shop', u),
  product: (u) => call('product', 'GET', `/api/products/${pick(PRODUCTS)}`, u),
  orders: (u) => call('orders', 'GET', '/api/orders?limit=10', u),
  checkout: async (u) => {
    await call('cart', 'PUT', `/api/cart/items/${pick(PRODUCTS)}`, u, { quantity: 1 });
    await call('checkout', 'POST', '/api/checkout', u, { paymentMethod: 'pm_card_visa' }, { 'Idempotency-Key': `load-${Math.random().toString(36).slice(2)}${Date.now()}` });
  },
};
const MIX = [['front', 0.45], ['product', 0.25], ['orders', 0.2], ['checkout', 0.1]];
function chooseAction(only) {
  if (only) return only;
  let r = Math.random();
  for (const [name, w] of MIX) { if ((r -= w) < 0) return name; }
  return 'front';
}

// ---------- server CPU/memory samples (non-blocking so the generator is not disturbed) ----------
const samples = [];
let lastCpu = null;
function sampleServer() {
  execFile('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${server.pid}; "$($p.CPU) $($p.WorkingSet64)"`], (err, out) => {
    if (err) return;
    const [cpu, ws] = out.trim().split(' ').map(Number);
    const now = performance.now();
    if (lastCpu) samples.push({ t: Math.round((now - START) / 1000), cpuPercentOfOneCore: Math.round(((cpu - lastCpu.cpu) / ((now - lastCpu.now) / 1000)) * 100), memoryMB: Math.round(ws / 1048576) });
    lastCpu = { cpu, now };
  });
}
const sampler = setInterval(sampleServer, 5000);
const loopDelay = monitorEventLoopDelay({ resolution: 5 });
loopDelay.enable();

// ---------- open-model phases: requests are sent on a schedule, whether or not earlier ones finished ----------
function summarize(recs) {
  const by = {};
  for (const r of recs) (by[r.name] ||= []).push(r);
  const stat = (rs) => {
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    return { count: rs.length, errorPct: +((rs.filter(isError).length / Math.max(1, rs.length)) * 100).toFixed(3), p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)), p99: Math.round(pct(ms, 99)), max: Math.round(ms[ms.length - 1] || 0) };
  };
  const outcomes = {}; // e.g. "200": 6000, "ECONNRESET": 120, "500": 3
  for (const r of recs) { const k = r.status || r.err || 'unknown'; outcomes[k] = (outcomes[k] || 0) + 1; }
  return { all: stat(recs), outcomes, byEndpoint: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, stat(v)])) };
}
async function phase({ name, rate0, rate1 = rate0, durSec, only, abortOnBreak }) {
  console.log(`\n== ${name}: ${rate0}${rate1 !== rate0 ? `→${rate1}` : ''} req/s for up to ${durSec}s`);
  const from = records.length, t0 = performance.now(), timeline = [];
  let sent = 0, n = 0, verdict = null;
  const cum = (t) => rate0 * t + ((rate1 - rate0) * t * t) / (2 * durSec);
  await new Promise((resolve) => {
    const finish = () => { clearInterval(tick); clearInterval(evalTimer); resolve(); };
    const tick = setInterval(() => {
      const t = Math.min((performance.now() - t0) / 1000, durSec);
      const should = Math.floor(cum(t));
      while (sent < should) {
        sent++;
        if (inflight >= MAX_INFLIGHT) { dropped++; continue; }
        inflight++;
        ACTIONS[chooseAction(only)](users[n++ % users.length]).finally(() => inflight--);
      }
      if (t >= durSec) finish();
    }, 5);
    const evalTimer = setInterval(() => {
      const t = (performance.now() - t0) / 1000, now = performance.now() - START;
      const win = [];
      for (let i = records.length - 1; i >= from && records[i].t > now - 5000; i--) win.push(records[i]);
      const ms = win.map((r) => r.ms).sort((a, b) => a - b);
      const point = { t: Math.round(t), targetRate: Math.round(rate0 + ((rate1 - rate0) * t) / durSec), achievedRate: Math.round(win.length / 5), errorPct: +((win.filter(isError).length / Math.max(1, win.length)) * 100).toFixed(2), p95: Math.round(pct(ms, 95)), generatorLagP99ms: +(loopDelay.percentile(99) / 1e6).toFixed(1), inflight, dropped };
      loopDelay.reset();
      timeline.push(point);
      if (Math.round(t) % 10 === 0 || abortOnBreak) console.log(`  t=${point.t}s target=${point.targetRate}/s done=${point.achievedRate}/s err=${point.errorPct}% p95=${point.p95}ms genLag=${point.generatorLagP99ms}ms inflight=${inflight}`);
      if (serverExited) { verdict = { reason: 'server process died', atRate: point.targetRate }; finish(); }
      else if (abortOnBreak && t > 15 && (point.errorPct > 5 || point.p95 > 2000)) { verdict = { reason: point.errorPct > 5 ? 'errors above 5%' : 'p95 above 2000 ms', atRate: point.targetRate, window: point }; finish(); }
    }, 1000);
  });
  const t1 = performance.now();
  while (inflight > 0 && performance.now() - t1 < TIMEOUT_MS + 1000) await new Promise((r) => setTimeout(r, 50)); // drain
  const recs = records.slice(from);
  return { name, plannedRate: [rate0, rate1], durationSec: Math.round((performance.now() - t0) / 1000), ...summarize(recs), verdict, timeline };
}

const result = { startedAt: new Date().toISOString(), machine: { cpus: os.cpus().length, cpuModel: os.cpus()[0].model, node: process.version, platform: process.platform }, target: `own copy on :${PORT} (limits x100000, payment stub 80 ms, ${USERS} users)`, phases: [] };
START = performance.now();
sampleServer();
if (!RAMP_ONLY) {
  result.phases.push(await phase({ name: 'steady-mixed', rate0: 10, durSec: 60 }));
  result.phases.push(await phase({ name: 'checkout-only', rate0: 2, durSec: 30, only: 'checkout' }));
}
if (!STEADY_ONLY) result.phases.push(await phase({ name: 'breakpoint-ramp', rate0: 10, rate1: 2500, durSec: 120, abortOnBreak: true }));
result.serverSamples = samples;
result.dropped = dropped;
result.serverStderr = serverStderr.slice(0, 1500);
result.finishedAt = new Date().toISOString();
const OUT = join(ROOT, 'reports', 'load-test.json');
if (RAMP_ONLY) { // keep the steady and checkout phases from the earlier full run, replace the ramp and its server samples
  const prev = JSON.parse((await import('node:fs')).readFileSync(OUT, 'utf8'));
  prev.phases = [...prev.phases.filter((p) => p.name !== 'breakpoint-ramp'), ...result.phases];
  Object.assign(prev, { serverSamples: result.serverSamples, dropped: result.dropped, serverStderr: result.serverStderr, rampRerunAt: result.finishedAt });
  Object.assign(result, prev);
}

clearInterval(sampler); loopDelay.disable(); agent.destroy();
server.kill();
await new Promise((r) => (serverExited ? r() : server.once('exit', r)));
rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('\n== SUMMARY');
for (const p of result.phases) console.log(`${p.name}: ${p.all.count} requests, errors ${p.all.errorPct}%, p50 ${p.all.p50} ms, p95 ${p.all.p95} ms, p99 ${p.all.p99} ms${p.verdict ? ` | stopped: ${p.verdict.reason} at ~${p.verdict.atRate} req/s` : ''}`);
console.log(`dropped (generator at max in-flight): ${dropped}. Wrote reports/load-test.json`);
