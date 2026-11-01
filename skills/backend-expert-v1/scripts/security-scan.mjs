#!/usr/bin/env node
// Static scan for the backend red flags in SKILL.md and references/security.md.
// Usage: node security-scan.mjs <project-dir> [--json]
// Add "scan-ignore" in a comment on a line to silence a finding you have reviewed (for example seeded test users).
// Regex heuristics, not a proof: a clean run does NOT mean secure, and every finding needs a human look.
// Real testing (IDOR with two users, rate limits, injection) belongs to tester-expert-v1 using the Test Handoff.
// Exit code 1 when any error is found.
import { fileURLToPath } from 'node:url';
import { walk, findRoutes, isTest, CLIENT_FILE } from './call-map.mjs';

const AUTH = /require(?:User|Auth|Admin|Role|Login|Session)|authenticate|isAuthenticated|authorize|verifyToken|jwt\.verify|getSession|ensureAuth|checkAuth|passport|\bauth\(/i;
// the handler uses the caller's identity somewhere (owner column, user id, tenant): the usual sign that the object is scoped
const OWNER = /(user|owner|tenant|org|account|customer)_?id|owner|require\w+\([^)]*\)\.id|\buser\.id|\bsession\.user/i;
const TOKEN_PATTERNS = [
  [/\bsk_live_[0-9a-zA-Z]{10,}/, 'live payment secret key'], [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'], [/\bservice_role\b/, 'Supabase service_role key'],
  [/(?:NEXT_PUBLIC|VITE|REACT_APP)_\w*(?:SECRET|PRIVATE|SERVICE_ROLE|ADMIN)\w*/, 'secret exposed through a public env prefix'],
];

export function scan(dir) {
  const files = walk(dir).filter((f) => !isTest(f.file));
  const out = [];
  const add = (sev, code, file, text, i, msg) => out.push({ sev, code, where: `${file}:${text.slice(0, i).split('\n').length}`, msg });
  const lineIgnored = (text, i) => /scan-ignore/.test(text.slice(text.lastIndexOf('\n', i) + 1, text.indexOf('\n', i) < 0 ? undefined : text.indexOf('\n', i)));
  const report = (sev, code, file, text, i, msg) => { if (!lineIgnored(text, i)) add(sev, code, file, text, i, msg); };
  let routeCount = 0;

  for (const { file, text } of files) {
    const client = CLIENT_FILE.test(file);
    for (const [re, what] of TOKEN_PATTERNS) {
      const m = re.exec(text);
      if (m) report('error', 'SECRET_IN_CODE', file, text, m.index, `${what}: remove it, rotate it, and keep it server-side in environment variables`);
    }
    for (const m of text.matchAll(/(secret|api_?key|token|password)['"]?\s*[:=]\s*(['"])([^'"\s$]{8,})\2/gi)) {
      if (/^(your|xxx|<|process|example)/i.test(m[3])) continue;
      if (client) report('error', 'SECRET_IN_CLIENT', file, text, m.index, `hard-coded ${m[1]} in browser-visible code`);
      else report('warn', 'HARDCODED_CREDENTIAL', file, text, m.index, `hard-coded ${m[1]}: fine only for seeded test data; real ones belong in environment variables`);
    }
    if (client) continue;

    const lines = text.split('\n');
    let off = 0;
    lines.forEach((ln, n) => {
      const at = off;
      off += ln.length + 1;
      const near = lines.slice(Math.max(0, n - 4), n + 5).join('\n');
      // the hashed value must be a password (same or next line); sha256 of a session token is correct
      if (/createHash\(\s*['"](?:md5|sha-?1|sha-?256|sha-?512)['"]\)/i.test(ln) && /password|passwd|pwd/i.test(`${ln}\n${lines[n + 1] ?? ''}`)) {
        report('error', 'WEAK_PASSWORD_HASH', file, text, at, 'MD5/SHA is not a password hash: use Argon2id (or scrypt/bcrypt) with a per-user salt');
      }
      if (/bcrypt\w*\.(?:hash|hashSync)\([^,)]+,\s*(\d+)/.test(ln) && Number(ln.match(/bcrypt\w*\.(?:hash|hashSync)\([^,)]+,\s*(\d+)/)[1]) < 10) {
        report('warn', 'LOW_BCRYPT_COST', file, text, at, 'bcrypt cost under 10: raise it (12+) or move to Argon2id');
      }
      if (/Math\.random\(\)/.test(ln) && /token|session|password|reset|otp|secret/i.test(near)) {
        report('warn', 'WEAK_RANDOM', file, text, at, 'Math.random() is predictable: use crypto.randomBytes / crypto.randomUUID for tokens and ids');
      }
      if (/\beval\(|new Function\(/.test(ln)) report('warn', 'EVAL', file, text, at, 'eval/new Function runs strings as code');
      if (/(?:res\.(?:send|json|end)|send)\([^)]*\b(?:err|error|e)\.(?:stack|message)/.test(ln)) {
        report('warn', 'ERROR_DETAIL_LEAK', file, text, at, 'error message or stack sent to the client: return a generic error plus a request id, log the detail');
      }
      if (/SELECT\s+\*/i.test(ln)) report('warn', 'SELECT_STAR', file, text, at, 'SELECT * can return columns the client must never see (hashes, internal ids): list the columns');
      if (/['"]\s*(?:SELECT|DELETE|UPDATE|INSERT)\b[^'"\n]*['"]\s*\+/i.test(ln)) {
        report('error', 'SQL_CONCAT', file, text, at, 'SQL built by string concatenation: use placeholders');
      }
      if (/jwt\.sign\(/.test(ln) && !/expiresIn/.test(lines.slice(n, n + 6).join('\n'))) {
        report('warn', 'JWT_NO_EXPIRY', file, text, at, 'jwt.sign without expiresIn: tokens must expire');
      }
    });
    for (const m of text.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
      const exprs = [...m[1].matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
      // `IN (${marks})` with a "?,?,?" string is the standard safe way to bind a list
      if (/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(m[1]) && /\b(?:FROM|INTO|SET|WHERE)\b/i.test(m[1]) && exprs.some((x) => !/^(?:marks|placeholders?|qs)$/i.test(x))) {
        report('warn', 'SQL_INTERPOLATION', file, text, m.index, 'SQL template with ${...}: placeholders only for values; interpolate only constants you control');
      }
    }
    for (const m of text.matchAll(/prepare\(\s*([`'"])([\s\S]*?)\1\s*\)\s*\.all\(/g)) {
      if (/\bSELECT\b/i.test(m[2]) && !/\bLIMIT\b|COUNT\(|\bMAX\(|\bSUM\(|\bIN\s*\(/i.test(m[2])) {
        report('warn', 'UNBOUNDED_QUERY', file, text, m.index, 'SELECT ... .all() without LIMIT: cap every list (default 25, max 100)');
      }
    }
    const wildcard = /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|origin:\s*(?:['"]\*['"]|true)|\bcors\(\s*\)/.exec(text);
    if (wildcard) {
      const creds = /credentials:\s*true|Access-Control-Allow-Credentials['"]?\s*[,:]\s*['"]true/.test(text);
      report(creds ? 'error' : 'warn', creds ? 'CORS_WILDCARD_CREDENTIALS' : 'CORS_WILDCARD', file, text, wildcard.index,
        creds ? 'any origin allowed together with credentials: allowlist exact origins' : 'any origin allowed: fine for a public read-only API, otherwise allowlist origins');
    }
    const cookie = /Set-Cookie|res\.cookie\(|\.cookie\(|setCookie/.exec(text);
    if (cookie) {
      if (!/HttpOnly|httpOnly/.test(text)) report('error', 'COOKIE_NOT_HTTPONLY', file, text, cookie.index, 'session cookie without HttpOnly: scripts (and XSS) can read it');
      if (!/SameSite|sameSite/.test(text)) report('warn', 'COOKIE_NO_SAMESITE', file, text, cookie.index, 'cookie without SameSite: set Lax (or Strict) as the CSRF baseline');
    }
    for (const r of findRoutes(text)) {
      routeCount++;
      const authed = AUTH.test(r.block);
      if (!authed) report('info', 'PUBLIC_ROUTE', file, text, r.index, `${r.method} ${r.path} shows no auth check: confirm it is meant to be public`);
      else if (r.path.includes(':p') && !OWNER.test(r.block)) {
        report('warn', 'OBJECT_ROUTE_NO_OWNER_CHECK', file, text, r.index, `${r.method} ${r.path} is authenticated but shows no owner/tenant check: BOLA/IDOR risk, test with two users`);
      }
    }
  }
  if (routeCount) {
    const all = files.map((f) => f.text).join('\n');
    const proj = (code, re, msg) => { if (!re.test(all)) out.push({ sev: 'warn', code, where: '-', msg }); };
    proj('NO_SECURITY_HEADERS', /Content-Security-Policy|helmet|X-Content-Type-Options/i, 'no security headers found: set CSP, X-Content-Type-Options, frame protection, HSTS');
    proj('NO_RATE_LIMIT', /rate.?limit|throttl|\b429\b|Retry-After/i, 'no rate limiting found: add per-class limits with 429 + Retry-After (references/capacity-and-rate-limits.md)');
    proj('NO_BODY_LIMIT', /content-length|maxBody|bodyLimit|MAX_(?:BODY|BYTES|SIZE)|\b413\b|too_large|limit:\s*['"]\d+\s?(?:kb|mb)/i, 'no request body size limit found (OWASP API4)');
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, flag] = process.argv.slice(2);
  if (!dir) { console.error('Usage: node security-scan.mjs <project-dir> [--json]'); process.exit(2); }
  const findings = scan(dir);
  if (flag === '--json') console.log(JSON.stringify(findings, null, 2));
  else {
    const rank = { error: 0, warn: 1, info: 2 };
    for (const f of findings.sort((a, b) => rank[a.sev] - rank[b.sev])) console.log(`${f.sev.toUpperCase().padEnd(5)} ${f.code.padEnd(28)} ${f.where}  ${f.msg}`);
    const n = (s) => findings.filter((f) => f.sev === s).length;
    console.log(`\n${n('error')} errors, ${n('warn')} warnings, ${n('info')} notes. Heuristic scan: it does not replace testing.`);
  }
  process.exitCode = findings.some((f) => f.sev === 'error') ? 1 : 0;
}
