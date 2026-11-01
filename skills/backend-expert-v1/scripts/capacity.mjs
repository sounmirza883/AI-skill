#!/usr/bin/env node
// Load estimate and rate-limit numbers from the formulas in references/capacity-and-rate-limits.md.
// Usage: node capacity.mjs --dau 1000 --reqs 200 [--hours 9] [--peak 3] [--resp 50] [--db 10] [--realtime 20]
//                          [--measured 300] [--margin 2] [--limit scan=1 --limit login=0.1]
//   dau       daily active users                      reqs     requests per user per day
//   hours     active hours per day (business 9, consumer 24)    peak  peak factor (B2B 2-3, consumer 5-10, flash sale 10-100)
//   resp, db  average response time / DB time per request, in ms
//   measured  req/s at which a load test broke (tester-expert-v1) to show the headroom
//   limit     name=rate: fastest legitimate req/s of ONE actor (a scanner, a human). Limit = rate x margin.
// Every input is an assumption until it comes from an interview or measurement: say so in the design doc.
import { fileURLToPath } from 'node:url';

export function estimate({ dau, reqs, hours = 9, peak = 3, resp = 50, db = 10, realtime = 0, measured, margin = 2, limits = {} }) {
  for (const [k, v] of Object.entries({ dau, reqs, hours, peak, resp, db, margin })) {
    if (!(Number(v) > 0)) throw new Error(`--${k} must be a positive number`);
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  const avg = (dau * reqs) / (hours * 3600);
  const peakRps = avg * peak;
  const design = peakRps * 3;
  const busyDb = design * (db / 1000);
  const out = {
    averageRps: r2(avg), peakRps: r2(peakRps), designRps: r2(design),
    concurrentRequests: r2(design * (resp / 1000)), busyDbConnections: r2(busyDb),
    suggestedPool: Math.max(10, Math.ceil(busyDb * 2)), openRealtimeConnections: realtime,
    rateLimits: Object.fromEntries(Object.entries(limits).map(([name, rate]) => [name, { perSecond: r2(rate * margin), perMinute: Math.ceil(rate * 60 * margin) }])),
    notes: [],
  };
  if (measured) out.headroom = r2(measured / peakRps);
  if (design < 100) out.notes.push('Small: one app server and one database are enough. Spend the effort on data integrity, authorization and table growth.');
  else if (design < 1000) out.notes.push('Medium: one well-tuned server may do it, but run two for redundancy and load-test before launch.');
  else out.notes.push('Large: measure with a load test and plan horizontal scaling, caching and read replicas on real numbers, not on this estimate.');
  if (out.suggestedPool > 30) out.notes.push('Pool above 30: check for slow queries before adding connections (references/database.md).');
  if (out.headroom !== undefined && out.headroom < 3) out.notes.push('Headroom under 3x peak: not enough margin.');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opts = { limits: {} };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i].replace(/^--/, ''), v = args[i + 1];
    if (!args[i].startsWith('--') || v === undefined) { console.error('Usage: node capacity.mjs --dau N --reqs N [--hours --peak --resp --db --realtime --measured --margin --limit name=rate]'); process.exit(2); }
    if (k === 'limit') { const [n, rate] = v.split('='); opts.limits[n] = Number(rate); } else opts[k] = Number(v);
  }
  try { console.log(JSON.stringify(estimate(opts), null, 2)); } catch (e) { console.error(e.message); process.exit(2); }
}
