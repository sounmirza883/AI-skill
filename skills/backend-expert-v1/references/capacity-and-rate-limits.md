# Capacity Estimation & Rate Limits

Estimate first, then design. Most business systems are much smaller than they feel — the estimate usually proves you
do **not** need microservices, Kafka or read replicas, and tells you exactly what limits are safe.

## 1. Research (when the agent has web access)

Search, read, and record each number with its source and date:

- Usage of comparable systems: "<system type> concurrent users", "<system type> peak hours", "<device> scans per minute".
- Published rate limits of comparable public APIs (their docs) — useful as a sanity check, not to copy blindly.
- Current OWASP guidance: "OWASP API Security Top 10", "OWASP Authentication Cheat Sheet" (login throttling).
- Hosting limits of the chosen platform (connection limits, function timeouts, DB connection caps).

No web access → use the defaults below and label them **assumption** in the design doc.

## 2. Formulas

```
Active seconds per day   = 86,400 (consumer, global)   or working hours × 3,600 (business app, e.g. 9h = 32,400)
Average RPS              = daily active users × requests per user per day ÷ active seconds
Peak RPS                 = average RPS × peak factor
                           (B2B steady: 2–3 · consumer: 5–10 · launches/flash sales: 10–100)
Design capacity          = peak RPS × 3 (headroom)
Concurrent requests      = RPS × average response time in seconds          (Little's law)
Busy DB connections      = RPS × average DB time per request in seconds    (pool size ≈ this × 2, usually 10–30)
Open realtime connections= users with a live screen open at peak
Storage growth / year    = new rows per day × average row size × 365 (+ indexes ≈ ×1.5–2)
```

## 3. Worked example — inventory management system

Assumptions (replace with interview answers): 3 warehouses, 60 staff with scanners, 15 managers, 40 supplier accounts,
3 admins, 9-hour working day, busiest hour = 2× average.

| Workload | Calculation | Peak |
|---|---|---|
| Scans (writes) | 60 staff × 1 scan / 4 s | 15 req/s |
| Scanner lookups | ~1 per scan | 15 req/s |
| Manager dashboards | 15 × 1 action / 10 s (live updates via SSE, not polling) | 1.5 req/s |
| Supplier portal | 40 × 30 req/day ÷ 32,400 s × 2 | < 0.1 req/s |
| **Total** | | **~32 req/s → design for ~100 req/s** |
| Concurrent requests | 100 req/s × 0.05 s | ~5 |
| Busy DB connections | 100 req/s × 0.01 s DB time | ~1 → pool of 10 is plenty |
| SSE connections | 15 managers + 3 admins | ~20 |
| Stock movements / year | 60 × 4,000 scans/day × 250 days × ~200 bytes | ~60M rows, ~12 GB + indexes |

**Conclusion for this example:** one app server (two for redundancy) + one managed PostgreSQL easily handles it. The
risks are not throughput — they are **data integrity** (concurrent stock updates), **authorization** (staff seeing other
warehouses, suppliers seeing other suppliers), and **table growth** (index and partition stock movements by month after
a few years). Spend effort there.

## 4. Rate limits

### Derive, don't guess

```
Limit = fastest legitimate rate for that action × 2–3 (safety margin)
```

A scanner can't scan faster than ~1/s → limit 2/s. A human can't save a form more than ~20 times a minute → 60/min.
Login needs only a handful of attempts → tight.

### Key by the right identity

- Authenticated routes: key by **user ID / device ID / API key**, not IP. A whole warehouse (or office, school, mobile
  carrier) can share one public IP — per-IP limits there would block everyone.
- Anonymous routes: key by IP (and by target account/email/phone for login, reset and OTP).
- Combine: login = per account **and** per IP.

### Default table (B2B app; adjust with the estimate)

| Class | Examples | Key | Limit | Notes |
|---|---|---|---|---|
| `auth-login` | POST /login | account + IP | 5 failures / 15 min per account; 20 / min per IP | Then progressive delay or temporary lock + email; same response whether the account exists or not |
| `auth-recovery` | password reset, magic link | account + IP | 3 / hour per account; 10 / hour per IP | |
| `otp` | send code / verify code | phone/email + IP | send 5 / hour; verify 5 tries per code | SMS costs money — attackers abuse it (SMS pumping) |
| `signup` | POST /register | IP | 10 / hour | Add bot protection (Turnstile/hCaptcha) on public sign-up |
| `read` | GET lists, details | user | 300 / min, burst 50 | |
| `write` | normal POST/PATCH/DELETE | user | 60 / min, burst 20 | |
| `device-write` | scanner stock movements | device + user | 120 / min (2/s), burst 10 | Derived from scan speed |
| `write-sensitive` | stock adjustment, price change, refund, role change | user | 30 / min | Plus audit log |
| `expensive` | reports, exports, full-text search | user | 10 / min and 1–2 concurrent | Run exports as background jobs |
| `public` | public catalog, status | IP | 60 / min | Prefer CDN caching over limiting |
| `admin` | /admin/* | admin user | 120 / min | Plus IP allowlist / zero-trust access |
| `webhook-in` | /webhooks/* | verified source | 1,000 / min | Verify signature before anything else |
| `edge-flood` | everything | IP | ~1,000 / min | At CDN/WAF/nginx, before the app |

### Algorithms

| Algorithm | Behavior | Use for |
|---|---|---|
| Token bucket | Steady rate + allowed bursts | Most API classes (default) |
| Sliding window | Smooth, no edge bursts | Login, OTP, anything security-sensitive |
| Fixed window | Simplest, allows 2× burst at window edges | Coarse limits only |
| Concurrency limit | Max N in flight per user | Exports, reports, AI calls |

State: in memory only for a single instance; **Redis** (or the gateway) when there is more than one instance.

### Where to enforce

1. **Edge** (Cloudflare/WAF, nginx, API gateway): IP floods, bots, body-size caps — cheapest place to drop traffic.
2. **App middleware**: per-user/per-key classes above (needs identity, so after auth).
3. **Database**: `statement_timeout` (e.g. 5s for API roles), pool limits, so one bad query can't take the system down.

### Response

- Status `429 Too Many Requests` with `Retry-After` (seconds). Optionally the IETF `RateLimit` / `RateLimit-Policy` headers.
- Log limit hits with user/IP and alert on spikes — they are an attack signal.

### Libraries (use the project's ecosystem)

| Stack | Library / feature |
|---|---|
| Express | `express-rate-limit` (+ `rate-limit-redis` store) |
| Fastify | `@fastify/rate-limit` |
| NestJS | `@nestjs/throttler` |
| Next.js / edge / serverless | `@upstash/ratelimit` |
| FastAPI / Starlette | `slowapi` |
| Django / DRF | DRF throttling classes, `django-ratelimit` |
| Laravel | `RateLimiter::for()` + `throttle` middleware |
| Rails | `rack-attack` |
| Go | `golang.org/x/time/rate`, `go-chi/httprate` |
| Spring | Bucket4j |
| .NET | `Microsoft.AspNetCore.RateLimiting` (built in) |
| nginx | `limit_req_zone` / `limit_req` |

```js
// Express: per-user write limit
import { rateLimit } from 'express-rate-limit';
const writeLimit = rateLimit({ windowMs: 60_000, limit: 60, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false });
app.post('/api/orders', requireAuth, writeLimit, createOrder);
```

```nginx
# Edge: per-IP flood protection
limit_req_zone $binary_remote_addr zone=perip:10m rate=20r/s;
server {
  location /api/ {
    limit_req zone=perip burst=40 nodelay;
    limit_req_status 429;
    client_max_body_size 1m;
  }
}
```

## 5. Other resource limits (OWASP API4: Unrestricted Resource Consumption)

| Limit | Default |
|---|---|
| JSON body size | 1 MB (uploads go to storage via presigned URL) |
| Page size | default 25, max 100 |
| Batch size | max 500 items per batch request |
| Request timeout | 10–30 s; long work → background job |
| DB statement timeout | 5 s for API traffic, longer for job workers |
| Upload size & type | explicit max size, allowlisted MIME types, verified server-side |
| GraphQL (if used) | max depth, max complexity, no introspection in production unless needed |
| Paid third-party calls (SMS, email, AI) | per-user daily caps and a global spend alert |
