# Security: Authentication, Authorization, Data Protection, API Hardening

Check the current OWASP cheat sheets online when you can (Password Storage, Authentication, Session Management,
Authorization, REST Security) — the numbers below match them at the time of writing; prefer newer guidance if it differs.

## 1. Authentication

### Choose the session model

| Client | Use | Why |
|---|---|---|
| First-party web app (same site) | **Server-side session** in a cookie | Instant revocation, no token in JavaScript, simplest to get right |
| Mobile app | Short-lived access token + rotating refresh token (OAuth 2.0 / OIDC) | No cookies; refresh in secure device storage (Keychain/Keystore) |
| Third-party developers / integrations | **API keys** or OAuth client credentials, with scopes | Per-integration revocation and limits |
| Service-to-service | mTLS or signed short-lived tokens (workload identity) | No long-lived shared secrets |
| Enterprise customers | SSO via OIDC/SAML (often through Auth0, Clerk, WorkOS, Keycloak, Cognito) | Their IT controls access |

Using a managed auth provider (Clerk, Auth0, Supabase Auth, Firebase Auth, Cognito) is usually safer than building login yourself — still apply authorization, rate limits and the checks below.

### Session cookies

```
Set-Cookie: __Host-session=<random 128+ bit id>; Path=/; Secure; HttpOnly; SameSite=Lax
```

- Regenerate the session ID on login and on privilege change (prevents session fixation).
- Idle timeout (e.g. 30 min admin, a few hours/days for normal users) + absolute timeout; logout deletes the server-side session.
- `SameSite=Strict` for admin portals. For cookie-authenticated state-changing requests, also check the `Origin` header or use a CSRF token.

### JWT (only where it fits)

- Access token 5–15 minutes; refresh token rotated on every use with **reuse detection** (reuse → revoke the whole family).
- Web: keep tokens in `HttpOnly` cookies, not `localStorage` (XSS can read `localStorage`).
- Pin the algorithm (e.g. `RS256`/`EdDSA`), reject `none`; validate `iss`, `aud`, `exp`, `nbf`; keep a deny-list for emergency revocation.
- Put IDs and roles in claims, never personal data — JWTs are readable by anyone holding them.

### Passwords — rules (NIST SP 800-63B rev. 4)

- Minimum **15 characters** when the password is the only factor; **8** when MFA is always required. Allow at least 64.
- No composition rules ("1 uppercase, 1 symbol"), no forced periodic changes (only on suspected compromise).
- Block common and breached passwords (e.g. Have I Been Pwned range API, which only sends a hash prefix).
- Allow paste and password managers. Same error message for "wrong email" and "wrong password".

### MFA

Preference: **passkeys / WebAuthn** → authenticator app (TOTP) → SMS (last resort; SIM-swap risk). **Mandatory for admins**
and for anyone who can move money, change roles or export data. Recovery codes hashed like passwords.

## 2. Password storage — hash, never encrypt

Passwords must be **one-way hashed with a slow, salted password-hashing algorithm**. Encryption is reversible — if the key
leaks, every password leaks. Plain SHA-256/MD5 are fast — GPUs crack billions per second.

| Algorithm | Minimum parameters (OWASP) | Notes |
|---|---|---|
| **Argon2id** (first choice) | memory 19 MiB (19,456 KiB), iterations 2, parallelism 1 | Or 46 MiB / 1 / 1 — trade memory for iterations |
| scrypt | N = 2^17, r = 8, p = 1 | If Argon2id isn't available |
| bcrypt | cost ≥ 10 | Legacy; input limited to 72 bytes — reject longer or use Argon2id |
| PBKDF2-HMAC-SHA256 | 600,000 iterations | Only when FIPS-140 compliance requires it |

The salt is generated and stored inside the hash string automatically. Optional **pepper**: an extra secret kept in a
secret manager (not the DB), applied as HMAC before hashing.

```js
// Node (argon2 package)
import argon2 from 'argon2';
const opts = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hash = await argon2.hash(password, opts);
const ok = await argon2.verify(hash, password);
if (ok && argon2.needsRehash(hash, opts)) await saveHash(userId, await argon2.hash(password, opts)); // upgrade old hashes on login
```

```python
# Python (argon2-cffi)
from argon2 import PasswordHasher
ph = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
hash = ph.hash(password)
ph.verify(hash, password)          # raises VerifyMismatchError on a wrong password
if ph.check_needs_rehash(hash): save_hash(user_id, ph.hash(password))
```

Migrating from weak hashes: wrap the old hash (`argon2id(md5_hash)`) for every user now, then re-hash the real password at next login.

## 3. What to hash, encrypt, or never store

| Data | Treatment |
|---|---|
| Passwords, recovery codes, PINs | Argon2id hash |
| API keys / tokens you issue | Generate 32 random bytes; show once; store **SHA-256 hash** + a short visible prefix for lookup (high entropy, so a fast hash is fine); scopes + expiry |
| Session IDs, reset tokens, magic-link tokens | Random 128+ bits; store hashed; single use; short expiry (reset ≤ 1 hour) |
| Personal data you must read back (phone, address, national ID, bank account) | **Encrypt** with AES-256-GCM (unique nonce per value), keys in KMS / secret manager, envelope encryption, key rotation plan |
| Encrypted fields you must search | Add a **blind index**: HMAC-SHA256(value, separate key) in its own column |
| Card numbers | **Don't store** — use the payment provider's tokens (keeps you out of most PCI-DSS scope) |
| Data in transit | TLS 1.2+ everywhere, including app → database and internal services |
| Data at rest | Disk/DB encryption from the provider + encrypted backups |
| Logs | Never log passwords, tokens, full card/ID numbers, session cookies; redact PII |

## 4. Authorization (where most real breaches happen)

**Authenticate once, authorize every object.** Being logged in does not mean the user may touch *this* record.

```js
// Owner/role check is part of the query — a missing match is a 404, which also hides that the record exists.
app.get('/api/items/:id', requireAuth, async (req, res) => {
  const item = await db.item.findFirst({ where: { id: req.params.id, warehouseId: { in: req.user.warehouseIds } } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(toItemDto(item, req.user.role)); // only fields this role may see
});
```

- Deny by default; centralize checks (policy functions / guards) instead of scattering `if (user.role === ...)`.
- **RBAC** for coarse permissions (staff, manager, supplier, admin); **ownership/attribute rules** for objects (own warehouse, own supplier, own tenant).
- Never trust IDs, roles, prices, tenant IDs or `isAdmin` flags sent by the client.
- Validate request bodies against an allowlist schema (zod, Joi, Pydantic, class-validator, Laravel FormRequest) — blocks mass assignment (`{"role":"admin"}`).
- Return only fields the caller may see (DTO/serializer per role) — never the raw DB row.
- Public IDs: UUIDv7/ULID make guessing harder, but they **do not replace** the ownership check.

### Multi-tenancy & multiple portals

- Tenant ID comes from the session, never from the request body or query.
- Enforce tenant scoping in one place: a repository layer that always adds `tenant_id`, or PostgreSQL **row-level security** with the tenant set per transaction.
- Portals (customer, supplier, staff, admin): one identity system, but each portal has its own **audience/scope**, its own
  cookie (separate subdomain), and only the routes it needs. A supplier token must be rejected by staff routes even if the user ID is valid.

### Admin access

- Separate app or route group (e.g. `admin.example.com`), separate session cookie with `SameSite=Strict` and short idle timeout.
- SSO + **mandatory MFA**; **step-up re-authentication** for destructive actions (delete, role change, bulk export, refund).
- Least privilege roles (viewer → operator → admin → owner); no shared admin accounts; break-glass account sealed and alerted.
- Network restriction where possible: VPN, zero-trust access (Cloudflare Access, Tailscale), or IP allowlist.
- **Audit log** for every admin action: who, what, target, before/after, IP, time — append-only, kept ≥ 1 year.
- Impersonation ("log in as user") is logged, time-limited, and visible to the user.

## 5. API hardening checklist — OWASP API Security Top 10 (2023)

| Risk | What to do |
|---|---|
| API1 Broken Object Level Authorization | Ownership/tenant check on every `/:id` read and write |
| API2 Broken Authentication | Session/token rules above, login rate limits, MFA, no credentials in URLs |
| API3 Broken Object Property Level Authorization | Allowlist input fields; role-based output DTOs |
| API4 Unrestricted Resource Consumption | Rate limits, pagination caps, body/upload limits, timeouts (see `capacity-and-rate-limits.md`) |
| API5 Broken Function Level Authorization | Role checks on admin/management routes; deny by default |
| API6 Unrestricted Access to Sensitive Business Flows | Protect flows bots abuse (checkout, sign-up, OTP, coupons) with limits, bot detection, business rules |
| API7 Server-Side Request Forgery | Allowlist outbound hosts for user-supplied URLs; block private IP ranges and cloud metadata addresses |
| API8 Security Misconfiguration | Security headers, strict CORS, no debug mode/stack traces, patched dependencies, least-privilege cloud roles |
| API9 Improper Inventory Management | Document every endpoint (OpenAPI); remove old versions and test/debug endpoints from production |
| API10 Unsafe Consumption of APIs | Validate third-party responses, timeouts, TLS, verify webhook signatures |

Also:

- **Injection:** parameterized queries / ORM only; never build SQL or NoSQL filters from raw strings; escape output.
- **CORS:** exact origin allowlist; never `Access-Control-Allow-Origin: *` together with credentials.
- **Headers:** `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `frame-ancestors` (or `X-Frame-Options`), `Referrer-Policy`.
- **Errors:** generic messages to clients, details in server logs with a request ID.
- **Secrets:** environment variables or a secret manager; never in git, frontend bundles or logs; rotate on staff changes and leaks. Scan the repo (gitleaks, GitHub secret scanning).
- **Dependencies:** lockfiles, automated updates (Dependabot/Renovate), audit in CI.
- **Uploads:** size + type allowlist, store outside the web root / in object storage, random names, scan if users share files.
- **Monitoring:** alert on spikes of 401/403/429, logins from new countries, admin actions, mass exports.

## 6. Breach readiness

- Backups encrypted, in a separate account, restore tested.
- Ability to: revoke all sessions, rotate all keys, force password reset, disable an integration — each in minutes.
- Know where personal data lives (data map) and the legal notification deadline for your users' region (e.g. 72 hours under GDPR).
