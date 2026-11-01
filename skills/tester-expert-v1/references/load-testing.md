# Load Testing with Virtual Users

Goal: prove the system handles the expected load, find **where and why it breaks**, and check that real-user
journeys (not one endpoint hammered in a loop) stay fast.

## 1. Ask first — always

Load tests send real traffic, can slow or crash an environment, trigger alerts, and cost money (servers, emails, SMS,
third-party calls). **Send this to the developer and wait for a clear "yes"** before running anything beyond a 1-user smoke test:

```md
I'd like to run a load test. Nothing runs until you approve.

- Target: <https://staging.example.com> (not production)
- What: realistic user journeys — browse 70%, search 20%, checkout 10% (payments use a stub / sandbox)
- Size: ramp to <200> virtual users (≈ <60> requests/second), hold <10> min; then a breakpoint test ramping until errors pass 5% (auto-stops)
- Duration: ~<40> minutes total, window <today 14:00–15:00>
- Expected impact: staging may slow down or error during the breakpoint test; rate limits and alerts may fire
- Not touched: production, real payment/email/SMS providers (stubbed), other companies' APIs

Questions: Is this target and window OK? Expected peak users in production? Should I include the breakpoint test?
```

If the answer changes the target, size or window, send the updated plan and wait again.

## 2. Pick the test types

| Type | Shape | Answers |
|---|---|---|
| Smoke | 1–5 virtual users, 1 min | Does the script work? (run without asking — it is tiny) |
| Average load | Ramp to normal peak, hold 10–30 min | Fast and error-free at expected traffic? |
| Stress | 1.5–2× peak | How does it degrade above normal? |
| Spike | Jump to 5–10× in seconds, drop back | Survives sudden bursts (launch, sale, viral post)? Recovers after? |
| Soak | Normal load for 1–4 h | Memory leaks, connection leaks, disk/log growth, slow drift |
| Breakpoint | Ramp until failure (auto-abort) | Maximum capacity and the first bottleneck |

## 3. Size the test from real numbers

Take targets from `BACKEND.md` → Test Handoff → Load targets, or the interview.

```
Peak requests/second  = (from capacity estimate) — e.g. 32 req/s for the inventory example
Virtual users needed  ≈ target req/s × seconds per iteration ÷ requests per iteration     (Little's law)
                        e.g. 60 req/s × 20 s (with think time) ÷ 4 requests ≈ 300 VUs
```

Real users pause between actions — include **think time** (2–10 s), different journeys with realistic weights, and
different test accounts and data. A test without think time measures a bot, not your users.

## 4. Install k6 (default tool; use Artillery, Locust, Gatling or JMeter if the project already has one)

```bash
winget install k6 --source winget
```

```bash
brew install k6
```

```bash
docker run --rm -i grafana/k6 run - < load.js
```

## 5. Realistic journey script

```js
// load.js — run: k6 run -e BASE_URL=https://staging.example.com load.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE_URL;
const JSON_HEADERS = { 'Content-Type': 'application/json' };
// Test accounts only, e.g. [{ "email": "load1@test.example", "password": "..." }, ...] — one per VU is ideal
const users = new SharedArray('users', () => JSON.parse(open('./users.json')));
const RUN = Date.now();

const ramp = (target) => [
  { duration: '2m', target },
  { duration: '10m', target },
  { duration: '1m', target: 0 },
];

export const options = {
  scenarios: {
    browsers: { executor: 'ramping-vus', exec: 'browse', startVUs: 0, stages: ramp(140) },
    searchers: { executor: 'ramping-vus', exec: 'search', startVUs: 0, stages: ramp(40) },
    buyers: { executor: 'ramping-vus', exec: 'buy', startVUs: 0, stages: ramp(20) },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:products}': ['p(95)<400'],
    'http_req_duration{name:search}': ['p(95)<600'],
    'http_req_duration{name:checkout}': ['p(95)<1500'],
  },
};

function login() {
  const u = users[(__VU - 1) % users.length];
  const res = http.post(`${BASE}/api/login`, JSON.stringify(u), { headers: JSON_HEADERS, tags: { name: 'login' } });
  check(res, { 'logged in': (r) => r.status === 200 }); // k6 keeps cookies per VU automatically
}

export function browse() {
  group('browse', () => {
    const list = http.get(`${BASE}/api/products?limit=24`, { tags: { name: 'products' } });
    check(list, { 'products 200': (r) => r.status === 200 });
    sleep(2 + Math.random() * 4);
    const items = list.status === 200 ? list.json('items') || [] : [];
    if (items.length) {
      const p = items[Math.floor(Math.random() * items.length)];
      check(http.get(`${BASE}/api/products/${p.id}`, { tags: { name: 'product' } }), { 'product 200': (r) => r.status === 200 });
    }
    sleep(3 + Math.random() * 5);
  });
}

export function search() {
  const terms = ['mug', 'shirt', 'blue', 'gift', 'xl'];
  const q = terms[Math.floor(Math.random() * terms.length)];
  check(http.get(`${BASE}/api/search?q=${q}`, { tags: { name: 'search' } }), { 'search 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 4);
}

export function buy() {
  if (__ITER === 0) login();
  const add = http.post(`${BASE}/api/cart/items`, JSON.stringify({ productId: 'load-test-product', quantity: 1 }),
    { headers: JSON_HEADERS, tags: { name: 'add_to_cart' } });
  check(add, { 'added to cart': (r) => r.status === 200 || r.status === 201 });
  sleep(2 + Math.random() * 3);
  const pay = http.post(`${BASE}/api/checkout`, JSON.stringify({ paymentMethod: 'pm_card_visa' }),
    { headers: { ...JSON_HEADERS, 'Idempotency-Key': `${RUN}-${__VU}-${__ITER}` }, tags: { name: 'checkout' } });
  check(pay, { 'checkout ok': (r) => r.status === 200 || r.status === 201 });
  sleep(5 + Math.random() * 5);
}
```

Adapt routes, payloads and weights to the app. Seed enough stock for `load-test-product`, and **stub the payment
provider on staging** for load tests — providers' sandboxes have their own rate limits and terms that usually forbid load testing them.

## 6. Breakpoint test (find the maximum)

```js
// breakpoint.js — ramps the request rate until errors or latency cross the line, then stops by itself
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10, timeUnit: '1s',
      preAllocatedVUs: 100, maxVUs: 2000,
      stages: [{ duration: '20m', target: 1000 }],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export default function () {
  // Mix of the most common read and write calls, weighted like real traffic
  const r = Math.random() < 0.8
    ? http.get(`${__ENV.BASE_URL}/api/products?limit=24`, { tags: { name: 'products' } })
    : http.get(`${__ENV.BASE_URL}/api/search?q=mug`, { tags: { name: 'search' } });
  check(r, { ok: (res) => res.status === 200 });
}
```

The request rate when it aborts (and the minute just before) is the capacity. Compare it with the expected peak:
**capacity should be ≥ 3× peak**.

## 7. Watch it live

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=load-report.html k6 run -e BASE_URL=https://staging.example.com load.js
```

This opens a live dashboard (default http://localhost:5665) with request rate, latency and errors, and saves an HTML
report. At the same time watch the **server side** — that is where the cause is:

| Watch | Where |
|---|---|
| CPU, memory per app instance | Hosting dashboard, `docker stats`, `htop` |
| DB connections in use / pool wait time | DB dashboard, `pg_stat_activity`, ORM pool metrics |
| Slow queries | `pg_stat_statements`, slow query log |
| Error logs, `5xx` by endpoint | App logs, APM (Sentry, Datadog, New Relic, OpenTelemetry) |
| Queue length, worker lag | Queue dashboard |
| Cache hit rate | Redis `INFO stats` |

## 8. Browser-level load (real pages under load)

API load says the server is fine; this says the **page** is still fast for a real browser while the server is busy. Run
a few browser users alongside the API load test.

```js
// browser-load.js — run during the API load test: k6 run -e BASE_URL=https://staging.example.com browser-load.js
import { browser } from 'k6/browser';

export const options = {
  scenarios: {
    ui: { executor: 'constant-vus', vus: 3, duration: '5m', options: { browser: { type: 'chromium' } } },
  },
  thresholds: { browser_web_vital_lcp: ['p(95)<2500'], browser_web_vital_cls: ['p(95)<0.1'] },
};

export default async function () {
  const page = await browser.newPage();
  try {
    await page.goto(`${__ENV.BASE_URL}/`);
    await page.goto(`${__ENV.BASE_URL}/products`);
  } finally {
    await page.close();
  }
}
```

Keep browser VUs low (each is a real Chromium); the API script generates the volume.

## 9. Rate limits during load tests

- One run **with** limits on, to prove they trigger (`429` + `Retry-After`) and the app stays healthy.
- Capacity runs use many distinct test accounts so per-user limits don't cap the test. If per-IP limits block the load
  generator, ask the developer to allowlist its IP **on staging only** — never disable protections in production.

## 10. Find the bottleneck

| Symptom | Likely cause | Confirm | Typical fix |
|---|---|---|---|
| Latency climbs while throughput stops rising | Saturation (the "knee") | Throughput vs VUs graph | That point is capacity; fix the resource below |
| Sudden errors / timeouts at a fixed load | DB pool or connection limit | Pool wait time, "too many connections" | Pool size, pooler (PgBouncer), shorter queries |
| One endpoint slow, others fine | Slow query / missing index / N+1 | Slow query log, `EXPLAIN ANALYZE` | Index, rewrite, batch |
| App CPU near 100% | Heavy code on the hot path (JSON, crypto, templates) | Profiler, flame graph | Optimize, cache, scale out |
| Memory grows during soak, restarts | Leak (listeners, caches without TTL, global arrays) | Heap graph over time | Fix the leak |
| `502`/`504` from proxy | Upstream timeouts | Proxy and app logs | Move slow work to jobs, tune timeouts |
| Errors only on writes, deadlocks | Lock contention | DB lock/deadlock logs | Short transactions, consistent lock order, atomic updates |
| Lots of `429` | Rate limits (expected?) | Which limit key fired | Fix test accounts, or limits if real users would hit them |
| Slow only for some calls | Third-party dependency | Traces, external call timing | Timeouts, retries with backoff, queue, cache |

Fix one bottleneck at a time, re-run the same test, compare numbers.

## 11. Load results report

```md
### Load test — <date>, <environment>, build <commit>

| Scenario | Peak VUs | Req/s | p95 | p99 | Errors | Result |
|---|---|---|---|---|---|---|
| Average load (journeys) | 200 | 61 | 320 ms | 780 ms | 0.03% | ✅ pass |
| Spike ×5 | 1,000 | 290 | 2.4 s | 5.1 s | 3.8% | ⚠️ degraded, recovered in 40 s |
| Breakpoint | — | **~620** | — | — | > 5% | capacity ≈ 10× expected peak |

**First bottleneck:** DB connection pool (max 10) saturated at ~600 req/s → requests queued → timeouts.
**Fix applied / proposed:** <…>, re-test result <…>
**Browser under load:** LCP p95 1.9 s, CLS 0.02 ✅
**Not covered:** <e.g. WebSocket load, file uploads, production-size data set>
```
