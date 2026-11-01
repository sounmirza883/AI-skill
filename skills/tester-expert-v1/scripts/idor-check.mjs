#!/usr/bin/env node
// Checks that another user and an anonymous visitor cannot read or change an owner's objects (IDOR / BOLA).
//
// Usage: OWNER="Cookie: session=<user A>" OTHER="Cookie: session=<user B>" node idor-check.mjs targets.txt
// targets.txt: one target per line, "GET https://staging.example.com/api/orders/123" (method optional, default GET).
//              Lines starting with # are ignored. Every URL must be an object owned by OWNER.
// Unsafe methods (POST/PUT/PATCH/DELETE) are never sent as OWNER, so the test does not change the owner's data itself.
// Exit code 1 if any LEAK is found. Only run against systems you may test.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file || !process.env.OWNER || !process.env.OTHER) {
  console.error('Usage: OWNER="Header: value" OTHER="Header: value" node idor-check.mjs targets.txt');
  process.exit(2);
}

const header = (s) => {
  const i = s.indexOf(':');
  if (i < 1) throw new Error(`Bad header "${s}", expected "Header-Name: value"`);
  return { [s.slice(0, i).trim()]: s.slice(i + 1).trim() };
};
const callers = { other: header(process.env.OTHER), anonymous: {}, owner: header(process.env.OWNER) };

const targets = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [a, b] = l.split(/\s+/);
    return b ? { method: a.toUpperCase(), url: b } : { method: 'GET', url: a };
  });

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const isBlocked = (s) => [401, 403, 404].includes(s) || (s >= 300 && s < 400); // redirect to login counts as blocked
const is2xx = (s) => s >= 200 && s < 300;

const rows = [];
for (const t of targets) {
  const row = { target: `${t.method} ${t.url}` };
  for (const [who, h] of Object.entries(callers)) {
    if (who === 'owner' && !SAFE.has(t.method)) { row.owner = 'skipped'; continue; }
    row[who] = await fetch(t.url, { method: t.method, headers: h, redirect: 'manual' })
      .then((r) => r.status)
      .catch(() => 'NETWORK_ERROR');
  }
  if (is2xx(row.other) || is2xx(row.anonymous)) row.verdict = 'LEAK';
  else if (!isBlocked(row.other) || !isBlocked(row.anonymous)) row.verdict = 'CHECK (unexpected status)';
  else if (row.owner !== 'skipped' && !is2xx(row.owner)) row.verdict = 'CHECK (owner not 2xx — wrong target?)';
  else row.verdict = 'ok';
  rows.push(row);
}

console.table(rows);
const leaks = rows.filter((r) => r.verdict === 'LEAK').length;
console.log(leaks ? `${leaks} LEAK(S) FOUND — S1 severity` : 'No leaks found');
process.exitCode = leaks ? 1 : 0; // not process.exit(): it crashes Node on Windows while fetch sockets are still open
