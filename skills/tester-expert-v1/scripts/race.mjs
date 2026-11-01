#!/usr/bin/env node
// Fires N identical requests at the same instant and tallies the responses.
// Finds double-submit, double-charge, oversell and rate-limit problems.
//
// Usage: node race.mjs <url> [count=10] [json-body='{}'] [idempotency-key]
// Env:   AUTH="Cookie: session=..." or AUTH="Authorization: Bearer ..."   METHOD=POST (default) | GET | PUT | PATCH | DELETE
// Output: JSON with the status-code tally and one sample response per status. Only run against systems you may test.

const [url, count = '10', body = '{}', key] = process.argv.slice(2);
if (!url) {
  console.error('Usage: node race.mjs <url> [count] [json-body] [idempotency-key]');
  process.exit(2);
}

const headers = { 'Content-Type': 'application/json' };
if (process.env.AUTH) {
  const i = process.env.AUTH.indexOf(':');
  if (i < 1) {
    console.error('AUTH must look like "Header-Name: value"');
    process.exit(2);
  }
  headers[process.env.AUTH.slice(0, i).trim()] = process.env.AUTH.slice(i + 1).trim();
}
if (key) headers['Idempotency-Key'] = key;
const method = (process.env.METHOD || 'POST').toUpperCase();

const results = await Promise.all(
  Array.from({ length: Number(count) }, () =>
    fetch(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : body })
      .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 200) }))
      .catch((e) => ({ status: 'NETWORK_ERROR', body: e.message })),
  ),
);

const statuses = {};
for (const r of results) statuses[r.status] = (statuses[r.status] || 0) + 1;
const samples = [...new Map(results.map((r) => [r.status, r])).values()];
console.log(JSON.stringify({ url, method, sent: results.length, statuses, samples }, null, 2));
