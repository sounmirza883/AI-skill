# API Correctness & Security Testing

Run on staging or local with test accounts. Never point scanners or brute-force tests at production or third parties
without explicit written approval.

## 1. Build the API inventory

Sources, best first: `BACKEND.md` → Test Handoff, an OpenAPI/Swagger file, route files, and **real traffic** captured
while E2E tests run:

```ts
// Record every API call the UI makes during a test run
const context = await browser.newContext({ recordHar: { path: 'test-results/api.har', urlFilter: '**/api/**' } });
// ... run the flows ...
await context.close(); // HAR is written on close
```

List each unique `METHOD /path`, which screen calls it, which roles may call it, and what it returns. Compare with the
backend routes: **routes no screen calls** (old/debug endpoints) and **calls with no matching documented route** are both findings.

## 2. Is every call correct and minimal?

For each call seen in the network panel / HAR:

| Check | Bad sign |
|---|---|
| Right status codes | `200` with `{"error": ...}`, `500` for bad input (should be `4xx`) |
| Response shape matches the contract/OpenAPI | Missing or renamed fields, wrong types |
| Called once per need | Same request twice on one page, polling while idle |
| Only needed data | Huge payloads, fields the UI never shows, other users' data in lists |
| Fast enough | > 500 ms for simple reads on staging |
| HTTPS only | Any `http://` call, mixed content warnings |
| Secrets not in URLs | Tokens, emails, IDs of sensitive records in query strings (they end up in logs) |
| Caching sensible | Private data with `Cache-Control: public`; static data with no caching |

## 3. Authentication tests

| Test | How | Expected |
|---|---|---|
| No credentials | Call every non-public endpoint without cookie/token | `401` (or redirect for pages) |
| Expired session/token | Use an old token / expired cookie | `401` |
| Tampered JWT | Change a claim (role, user ID) without re-signing | `401` |
| `alg: none` JWT | Header `{"alg":"none"}`, empty signature | `401` |
| Logged-out session reused | Copy the cookie, log out, replay | `401` |
| Login brute force | 10 wrong passwords for one account | Delay/lockout after ~5; `429` |
| Account enumeration | Wrong password vs unknown email; sign-up / reset with existing vs new email | Same message, similar response time |
| Password reset token | Reuse, use after 1 hour, use for another account | Rejected |
| MFA bypass | Call protected endpoints after password step but before MFA | `401`/`403` |

```bash
# Endpoint without credentials → expect 401
curl -s -o /dev/null -w "%{http_code}\n" https://staging.example.com/api/orders
```

## 4. Object-level authorization (IDOR / BOLA) — test every `/:id`

Create two users of the same role (A and B). Collect object URLs owned by A (orders, invoices, addresses, files,
messages). Then check B and an anonymous visitor are blocked:

```text
# targets.txt — one per line, method optional (default GET)
GET https://staging.example.com/api/orders/ord_A1
GET https://staging.example.com/api/invoices/inv_A1/pdf
PATCH https://staging.example.com/api/addresses/adr_A1
DELETE https://staging.example.com/api/files/fil_A1
```

```bash
OWNER="Cookie: session=<user A>" OTHER="Cookie: session=<user B>" node scripts/idor-check.mjs targets.txt
```

The script never sends unsafe methods (PATCH/PUT/POST/DELETE) as the owner, so A's data isn't changed by the test
itself. Any `LEAK` row is an **S1**. Also try: IDs in request bodies (`{"orderId": "ord_A1"}`), nested routes
(`/users/A/orders`), bulk endpoints (`?ids=ord_A1,ord_B1`), exports, file downloads, and GraphQL node IDs.

## 5. Function-level authorization (roles)

From the Test Handoff authorization matrix, call every admin/manager endpoint as each lower role and as anonymous.

| Expected | Bad sign |
|---|---|
| `403` (or `404`) for every action outside the role | `200`, or a `500` (crashed after skipping the check) |
| Supplier/partner portal tokens rejected on staff/admin routes | Any cross-portal success |
| UI hides admin buttons **and** the API refuses | API accepts when the button is hidden |

## 6. Mass assignment & property-level authorization

Send extra fields on create/update endpoints: `role`, `isAdmin`, `verified`, `balance`, `price`, `ownerId`,
`tenantId`, `status`, `createdAt`. Re-read the object: none may have changed. Also check **responses** per role — no
`passwordHash`, internal notes, cost prices, other users' emails, tokens or tenant IDs.

```bash
# Look for fields that should never leave the server
curl -s -H "Cookie: session=<user A>" https://staging.example.com/api/me | grep -Eio '"(password|hash|token|secret|salt|ssn|cost_?price|internal)[a-z_]*"'
```

## 7. Injection and dangerous input

Use the payloads from `break-it-playbook.md` §7 on every input, query parameter, header used by the app, and JSON field.

| Type | Probe | Bad sign |
|---|---|---|
| SQL | `' OR 1=1--`, `1;SELECT pg_sleep(5)` | `500`, SQL error text, 5s delay, more rows returned |
| NoSQL | `{"$ne": null}`, `{"$gt": ""}` in JSON | Login bypass, more rows |
| XSS (stored/reflected) | `<img src=x onerror=alert(1)>` in names, comments, search | Script runs when the value is shown anywhere (including admin panels and emails) |
| Template | `{{7*7}}`, `${7*7}` | `49` appears |
| Path traversal | `../../etc/passwd` in file names/paths | File content or `500` |
| SSRF (URL inputs: webhooks, image-from-URL, imports) | `http://169.254.169.254/`, `http://localhost:5432`, `http://[::1]` | Fetches internal resources |
| Header/CRLF | `%0d%0aSet-Cookie:x=y` in redirect params | Injected header |
| Open redirect | `?next=https://evil.example` | Redirects off-site |

## 8. Rate limits and resource limits

```bash
# 100 rapid requests to one endpoint: some must come back 429 with Retry-After
METHOD=GET AUTH="Cookie: session=<user A>" node scripts/race.mjs https://staging.example.com/api/products 100
```

- Login, password reset, OTP send/verify, sign-up: tight limits, keyed by account **and** IP.
- `?limit=100000`, huge bodies, 10,000-item batches: capped or `413`/`422`.
- Expensive endpoints (exports, reports, search): per-user limits; repeat calls don't stack up.
- `429` responses include `Retry-After`; the app shows a friendly message.

## 9. Transport, headers, CORS, cookies

```bash
curl -sI https://staging.example.com/ | grep -Ei 'strict-transport|content-security|x-content-type|x-frame|frame-ancestors|referrer-policy'
curl -sI http://staging.example.com/ | grep -i '^location'                # must redirect to https
curl -sI -H "Origin: https://evil.example" https://staging.example.com/api/me | grep -i 'access-control-allow'
```

| Check | Expected |
|---|---|
| HTTPS + HSTS | `Strict-Transport-Security` present; HTTP redirects to HTTPS |
| CSP, nosniff, frame protection, referrer policy | Present and not trivially permissive (`unsafe-inline` everywhere is a finding) |
| CORS | Unknown origins not reflected; never `*` with `Access-Control-Allow-Credentials: true` |
| Errors | No stack traces, SQL, file paths, framework debug pages |
| Server banners | No detailed version numbers (`X-Powered-By`, `Server: nginx/1.x.y`) |

## 10. What the browser exposes

```ts
import { test, expect } from '@playwright/test';

test('no tokens in web storage; session cookie locked down', async ({ page, context }) => {
  await loginAs(page, 'customer'); // run against HTTPS staging so Secure cookies are set
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(storage).not.toMatch(/eyJ[\w-]+\.[\w-]+\.|password|secret/i);
  const session = (await context.cookies()).find((c) => /sess|sid|auth/i.test(c.name));
  expect(session).toBeDefined();
  expect(session).toMatchObject({ httpOnly: true, secure: true });
  expect(['Lax', 'Strict']).toContain(session!.sameSite);
});
```

Search the built frontend for secrets (they are public once shipped):

```bash
grep -rEo "sk_live_[0-9a-zA-Z]{10,}|service_role|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]+" dist build .next/static out 2>/dev/null
```

Also check: source maps publicly served in production, `console.log` printing user data or tokens, sensitive data in
URLs, API keys visible in network requests to third parties that should be server-side.

## 11. Webhooks and integrations

- Unsigned or wrongly signed webhook → rejected (`400`/`401`), nothing processed.
- Replay an old valid webhook (old timestamp) → rejected or deduped by event ID.
- Same event delivered twice → processed once.
- Third-party returns garbage/timeout → handled, no crash, retried later.

## 12. File uploads

Wrong type renamed (`.exe` → `.jpg`), SVG/HTML with scripts, oversized files, zip bombs, path characters in the
filename, uploading to another user's resource. Expected: type checked by content, size capped, files served with a safe
`Content-Type` / `Content-Disposition` from a separate domain or storage, never executed.

## 13. Automated scanners (staging only, with approval)

```bash
# Passive baseline scan: spiders the site and reports missing headers, cookie flags, info leaks
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://staging.example.com
```

```bash
npm audit --omit=dev
```

```bash
gitleaks detect --source .
```

Use the project's ecosystem equivalents (`pip-audit`, `composer audit`, `bundle audit`, `govulncheck`, `osv-scanner`).
Scanner output is a lead, not a finding — confirm each item manually before reporting.

## 14. Report security findings by OWASP API Top 10 (2023)

| ID | Category | Where to look |
|---|---|---|
| API1 | Broken Object Level Authorization | §4 |
| API2 | Broken Authentication | §3 |
| API3 | Broken Object Property Level Authorization | §6 |
| API4 | Unrestricted Resource Consumption | §8 |
| API5 | Broken Function Level Authorization | §5 |
| API6 | Unrestricted Access to Sensitive Business Flows | break-it playbook (coupons, checkout, OTP abuse) |
| API7 | Server-Side Request Forgery | §7 |
| API8 | Security Misconfiguration | §9, §13 |
| API9 | Improper Inventory Management | §1 |
| API10 | Unsafe Consumption of APIs | §11 |
