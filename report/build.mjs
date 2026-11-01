// Builds report/work-report.html from real data: skills on disk, test run, git history, load-test results.
// Usage: node report/build.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = (f) => readFileSync(f, 'utf8').split('\n').length;
const run = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, ...opts }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };

// ---------- facts from disk ----------
const SKILLS = [
  ['premium-ui-expert-v1', 'Front end', 'Asks about UI and motion, studies reference sites with devtools, builds responsive, accessible, premium-feeling sites with 14 animation modules.'],
  ['backend-expert-v1', 'Back end', 'Maps frontend → backend → database calls, cuts requests, picks polling/SSE/WebSockets only where needed, sizes load, sets rate limits, designs auth and data protection, writes a Test Handoff.'],
  ['tester-expert-v1', 'Testing', 'Tries to break the app like users and attackers, tests features and their interactions, checks API security, fixes bugs with regression tests, load-tests after asking.'],
].map(([name, area, what]) => {
  const base = join(ROOT, 'skills', name);
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } };
  walk(base);
  return { name, area, what, files: files.length, lines: files.reduce((s, f) => s + lines(f), 0) };
});

const log = run('git', ['log', '--reverse', '--pretty=format:%h\t%ad\t%s', '--date=short']).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));

// ---------- fresh test run ----------
const testOut = run(process.execPath, ['--no-warnings', '--test', 'demo/shop/test/api.test.mjs', 'demo/shop/test/break-it.test.mjs', 'demo/shop/test/contrast.test.mjs', 'tests/tester-scripts.test.mjs']);
const tests = [...testOut.matchAll(/^([✔✖]) (.+?) \(\d[\d.]*ms\)$/gm)].filter((m) => !/^([A-Za-z]:\\|\/)/.test(m[2])).map((m) => ({ ok: m[1] === '✔', name: m[2] }));
const passed = tests.filter((t) => t.ok).length;

// ---------- load test ----------
const loadFile = join(ROOT, 'demo/shop/reports/load-test.json');
const load = existsSync(loadFile) ? JSON.parse(readFileSync(loadFile, 'utf8')) : null;

function chart(points, series, { w = 640, h = 220, yMax, xLabel, mark }) {
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const xs = points.map((p) => p.t), xMax = Math.max(...xs, 1);
  const top = yMax ?? Math.max(1, ...series.flatMap((s) => points.map((p) => p[s.key])));
  const X = (t) => pad.l + (t / xMax) * (w - pad.l - pad.r), Y = (v) => pad.t + (1 - Math.min(v, top) / top) * (h - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(xLabel)}" class="chart">
    ${ticks.map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('')}
    ${series.map((s) => `<polyline fill="none" stroke-width="2" class="${s.cls}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} points="${points.map((p) => `${X(p.t).toFixed(1)},${Y(p[s.key]).toFixed(1)}`).join(' ')}"/>`).join('')}
    ${mark != null ? `<line x1="${X(mark)}" x2="${X(mark)}" y1="${pad.t}" y2="${h - pad.b}" class="mark"/><text x="${X(mark) - 4}" y="${pad.t + 10}" text-anchor="end">stopped</text>` : ''}
    <text x="${w / 2}" y="${h - 6}" text-anchor="middle">${esc(xLabel)}</text>
    ${series.map((s, i) => `<text x="${pad.l + 8 + i * 150}" y="${pad.t + 12}" class="${s.cls} lg">${esc(s.label)}</text>`).join('')}
  </svg>`;
}
const row = (cells, tag = 'td') => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;

function loadSection() {
  if (!load) return '<p>The load test has not been run yet.</p>';
  const [steady, checkout, ramp] = load.phases;
  const targets = { steady: { p95: 200, err: 0.1 }, checkout: { p95: 600, err: 1 } };
  const verdictCell = (p, t) => (p.all.p95 < t.p95 && p.all.errorPct < t.err ? '<b class="ok">pass</b>' : '<b class="bad">fail</b>');
  let out = `<p class="muted">Machine: ${load.machine.cpus} CPU cores (${esc(load.machine.cpuModel)}), Node ${esc(load.machine.node)}. Target: ${esc(load.target)}. The load generator ran on the same machine as the server, so the two shared CPU.</p>`;
  out += `<div class="scroll"><table><thead>${row(['Phase', 'Rate', 'Requests', 'Errors', 'p50', 'p95', 'p99', 'Target (from Test Handoff)', 'Result'], 'th')}</thead><tbody>`;
  out += row(['Browse-heavy mix (45% front, 25% product, 20% orders, 10% checkout)', `${steady.plannedRate[0]} req/s × ${steady.durationSec}s`, steady.all.count, `${steady.all.errorPct}%`, `${steady.all.p50} ms`, `${steady.all.p95} ms`, `${steady.all.p99} ms`, `p95 < 200 ms, errors < 0.1%`, verdictCell(steady, targets.steady)]);
  out += row(['Checkout only (add to cart + pay)', `${checkout.plannedRate[0]} journeys/s × ${checkout.durationSec}s`, checkout.all.count, `${checkout.all.errorPct}%`, `${checkout.all.p50} ms`, `${checkout.all.p95} ms`, `${checkout.all.p99} ms`, `p95 < 600 ms, errors < 1%`, verdictCell(checkout, targets.checkout)]);
  out += '</tbody></table></div>';
  out += '<h3>Per request type (steady phase)</h3><div class="scroll"><table><thead>' + row(['Request', 'Count', 'Errors', 'p50', 'p95', 'p99'], 'th') + '</thead><tbody>';
  for (const [k, s] of Object.entries(steady.byEndpoint)) out += row([esc(k), s.count, `${s.errorPct}%`, `${s.p50} ms`, `${s.p95} ms`, `${s.p99} ms`]);
  out += '</tbody></table></div>';
  if (ramp) {
    const tl = ramp.timeline, v = ramp.verdict;
    const firstSlow = tl.findIndex((p) => p.p95 >= 200 || p.errorPct >= 0.1);
    const comfortable = tl[(firstSlow === -1 ? tl.length : firstSlow) - 1]; // last window before latency or errors first went past the targets
    const cpuMax = Math.max(0, ...load.serverSamples.map((s) => s.cpuPercentOfOneCore));
    const lagAtEnd = Math.max(...tl.slice(-5).map((p) => p.generatorLagP99ms));
    out += `<h3>Breakpoint ramp: 10 → 2,500 req/s over up to 120 seconds</h3>`;
    out += v
      ? `<p><b class="bad">It broke.</b> The test stopped by itself at about <b>${v.atRate} requests/second</b> because of <b>${esc(v.reason)}</b>. Latency stayed under 200 ms (p95) with no errors up to about <b>${comfortable ? comfortable.targetRate : 'n/a'} req/s</b>. For comparison, the capacity estimate in <code>BACKEND.md</code> expects a real peak of about 3.5 req/s, so the shop has roughly ${comfortable ? Math.round(comfortable.targetRate / 3.5) : 'n/a'}× headroom on this machine.</p>${load.rampRerunAt ? '<p class="muted">The ramp was run twice. The first run did not record what kind of errors happened, so the numbers below are from a second, ramp-only run with error details added. The two runs broke at similar rates (about 530 and 550 req/s).</p>' : ''}`
      : `<p><b class="ok">It did not break</b> anywhere up to the 2,500 req/s ceiling of this test.</p>`;
    out += chart(tl, [{ key: 'targetRate', cls: 's-dash', label: 'requests sent per second', dash: true }, { key: 'achievedRate', cls: 's-a', label: 'requests finished per second' }], { xLabel: 'seconds into the ramp', mark: v ? tl[tl.length - 1].t : null });
    out += chart(tl, [{ key: 'p95', cls: 's-b', label: 'p95 latency (ms, capped at 2000)' }, { key: 'errorPct', cls: 's-c', label: 'error %' }], { xLabel: 'seconds into the ramp', yMax: 2000, mark: v ? tl[tl.length - 1].t : null });
    const oc = ramp.outcomes || {};
    const refused = oc.ECONNREFUSED || 0, fiveXX = Object.entries(oc).filter(([k]) => /^5\d\d$/.test(k)).reduce((s, [, n]) => s + n, 0);
    out += `<h3>Where is the bottleneck?</h3><ul>
      <li>What failed: ${Object.entries(oc).map(([k, n]) => `<code>${esc(k)}</code> × ${n}`).join(', ') || 'n/a'}. ${refused && !fiveXX ? `<b>No server errors (no 5xx) and nothing in the server log.</b> Every failure was <code>ECONNREFUSED</code>: the server could not accept new connections because its queue of waiting connections was full. That fits Node's default queue size of 511 (about 500 requests were in flight when it broke); this link was inferred from the numbers, not separately proven.` : ''} <code>409</code> responses are expected: with only 40 test shoppers at this speed, two checkouts for the same person overlapped, and the second found an empty cart.</li>
      <li>Highest server CPU seen: <b>${cpuMax}% of one core</b> (the machine has ${load.machine.cpus} cores). ${cpuMax >= 80 ? 'The server is one Node.js thread, so it can use only about one core: that thread is the limit.' : 'The server thread was not fully busy when the test stopped, so the limit is probably elsewhere (the load generator, the network stack, or SQLite).'}</li>
      <li>Load generator event-loop lag near the end: <b>${lagAtEnd} ms</b> (p99). ${lagAtEnd > 50 ? 'High: the load generator was struggling too, so the real server limit may be higher than measured.' : 'Low: the generator was keeping up, so the measured limit is the server.'}</li>
      <li>Requests the generator skipped because too many were already in flight: <b>${load.dropped}</b>.</li>
      <li>Memory of the server at the end: <b>${load.serverSamples.at(-1)?.memoryMB ?? 'n/a'} MB</b>.</li></ul>`;
  } else out += '<p class="muted">The breakpoint ramp was not run.</p>';
  return out;
}

// ---------- static story ----------
const BUGS = [
  ['B-01', 'S2', 'Checkout', 'A declined card emptied the cart', 'Add an item, pay with the "declined" test card, then try again.', 'The failure path gave the stock back but not the cart, so the shopper had nothing left to retry with ("Your cart is empty").', 'Failure transaction now restores stock and cart together (capped at 20 per item).', 'break-it: "declined card…" and "after a decline, paying again…"'],
  ['B-02', 'S3', 'API security', '"Origin: null" caused a server error (500)', 'Send a PUT with header Origin: null (browsers send this from sandboxed frames).', '`new URL("null")` throws inside the cross-site check, so the request crashed instead of being refused.', 'Bad or unparsable Origin is treated as foreign → 403.', 'break-it: "cross-site requests…" (4 origins)'],
  ['B-03', 'S3', 'UI', 'Expired session on the pay page: dead-end message', 'Log in, open checkout, let the session end, press Pay → "Something went wrong. Please try again." forever.', 'The checkout handler had no case for 401.', '401 now sends the shopper to the login page with "Please log in to continue."', 'Reproduced and verified in the built-in browser (no automated browser test: Playwright is not installed)'],
  ['B-04', 'S3', 'Deploys', 'JS and CSS cached for an hour with no versioning', 'Change app.js, reload: the browser can keep running the old file.', 'Static files had `max-age=3600` and no file-name fingerprint.', 'Static files now revalidate. Production should use hashed file names plus long caching.', 'break-it: "static files are never served with a long cache lifetime" (added together with the fix, not red-first)'],
];
const AGENTS = [['Claude Code', '.claude/skills/', '~/.claude/skills/'], ['OpenAI Codex', '.agents/skills/', '~/.agents/skills/'], ['Cursor', '.agents/skills/', '~/.cursor/skills/'], ['GitHub Copilot', '.agents/skills/', '~/.copilot/skills/'], ['Google Antigravity', '.agents/skills/', '~/.gemini/antigravity/skills/'], ['OpenCode', '.agents/skills/', '~/.config/opencode/skills/'], ['Kimi Code CLI', '.agents/skills/', '~/.agents/skills/']];

const failed = tests.filter((t) => !t.ok).length;
const bugCount = BUGS.length;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Skills Work Report</title>
<meta name="color-scheme" content="light dark">
<style>
:root{--bg:#FAF8F4;--surface:#fff;--border:#E7E2D9;--text:#1A1814;--muted:#6B655C;--accent:#B4532A;--ok:#0F7B55;--bad:#B42318;--a:#1F5EFF;--b:#B4532A;--c:#B42318}
@media (prefers-color-scheme:dark){:root{--bg:#111110;--surface:#1A1917;--border:#2C2A27;--text:#EFEBE4;--muted:#A39D93;--accent:#E07A4F;--ok:#3DBE8B;--bad:#F2877B;--a:#7AA2FF;--b:#E07A4F;--c:#F2877B}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:400 1rem/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{width:min(1080px,100% - 32px);margin-inline:auto}header{padding:56px 0 24px}h1{font:600 clamp(2rem,1.2rem + 3.5vw,3.4rem)/1.05 ui-serif,Georgia,serif;letter-spacing:-.03em;margin:0 0 12px;text-wrap:balance}
h2{font:600 1.6rem/1.2 ui-serif,Georgia,serif;letter-spacing:-.02em;margin:0 0 16px}h3{font-size:1.05rem;margin:24px 0 8px}section{padding:32px 0;border-top:1px solid var(--border)}
p{margin:0 0 12px}.muted{color:var(--muted)}.lede{font-size:1.15rem;max-width:62ch}
.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:24px 0}.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}.card b{display:block;font:600 2rem/1.1 ui-serif,Georgia,serif}.card span{color:var(--muted);font-size:.9rem}
.scroll{overflow-x:auto;border:1px solid var(--border);border-radius:14px;background:var(--surface);margin:8px 0 16px}table{border-collapse:collapse;width:100%;font-size:.92rem}th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:top}th{font-weight:600;color:var(--muted);white-space:nowrap}tr:last-child td{border-bottom:0}
.ok{color:var(--ok)}.bad{color:var(--bad)}code{font:.88em ui-monospace,Menlo,monospace;background:color-mix(in oklch,var(--text) 8%,transparent);padding:1px 6px;border-radius:6px}
.sev{display:inline-block;padding:1px 9px;border-radius:99px;border:1px solid currentColor;font-weight:600;font-size:.8rem}.chart{width:100%;height:auto;background:var(--surface);border:1px solid var(--border);border-radius:14px;margin:8px 0;font-size:11px;fill:var(--muted)}
.chart .grid{stroke:var(--border)}.chart .mark{stroke:var(--bad);stroke-dasharray:3 3}.chart .s-a{stroke:var(--a)}.chart .s-b{stroke:var(--b)}.chart .s-c{stroke:var(--c)}.chart .s-dash{stroke:var(--muted)}.chart text.lg{font-weight:600}.chart text.s-a{fill:var(--a)}.chart text.s-b{fill:var(--b)}.chart text.s-c{fill:var(--c)}.chart text.s-dash{fill:var(--muted)}.chart polyline{stroke:currentColor}
details{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 16px;margin:8px 0}summary{cursor:pointer;font-weight:600}ul{padding-left:20px}li{margin:4px 0}
@media (max-width:560px){th,td{padding:8px 10px}}
</style></head><body><div class="wrap">
<header><p class="muted">Work report · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
<h1>Three agent skills, one demo shop, ${bugCount} bugs found and fixed</h1>
<p class="lede">You asked for a front-end skill, a back-end skill and a tester skill, usable by any coding agent. They are built, installed, and were used on a small demo shop. This page shows what was done and what the tests found.</p>
<div class="cards">
<div class="card"><b>3</b><span>skills built (${SKILLS.reduce((s, k) => s + k.lines, 0).toLocaleString()} lines across ${SKILLS.reduce((s, k) => s + k.files, 0)} files)</span></div>
<div class="card"><b>7</b><span>coding agents supported by the installer</span></div>
<div class="card"><b class="${failed ? 'bad' : 'ok'}">${passed}/${tests.length}</b><span>automated tests passing (fresh run when this page was built)</span></div>
<div class="card"><b>${bugCount}</b><span>bugs found by the tester skill and fixed with tests</span></div>
<div class="card"><b>${log.length}</b><span>Git commits in this project</span></div></div></header>

<section><h2>1. The three skills</h2>
<div class="scroll"><table><thead>${row(['Skill', 'Area', 'What it does', 'Files', 'Lines'], 'th')}</thead><tbody>${SKILLS.map((s) => row([`<code>${esc(s.name)}</code>`, s.area, esc(s.what), s.files, s.lines.toLocaleString()])).join('')}</tbody></table></div>
<p>In Claude Code, type <code>/premium-ui-expert-v1</code>, <code>/backend-expert-v1</code> or <code>/tester-expert-v1</code>. The skills also load automatically when your request matches them.</p>
<h3>Where each agent finds them</h3>
<div class="scroll"><table><thead>${row(['Agent', 'In a project', 'For all your projects (installed now)'], 'th')}</thead><tbody>${AGENTS.map((a) => row(a.map((c) => `<code>${esc(c)}</code>`))).join('')}</tbody></table></div>
<p class="muted">Folder paths come from the community-maintained vercel-labs/skills list, not from each vendor's own documentation. Install with <code>node install.mjs --global</code>.</p></section>

<section><h2>2. The demo shop: what each skill did</h2>
<h3>backend-expert-v1 → server, database, design doc</h3><ul>
<li>One request renders the shop front (user + products + cart); cart changes return the new cart, so nothing is refetched. Idle pages send 0 requests.</li>
<li>Checkout is safe against double clicks: idempotency key, atomic stock update, cart consumed in one transaction, payment call outside any transaction.</li>
<li>Passwords: Argon2id at the OWASP minimum. Sessions: random token, only its SHA-256 stored. Order lookups check the owner inside the SQL and return 404 for other people's orders.</li>
<li>Rate limits per request type (login failures per account, checkout 10/min, reads 300/min), CSRF origin check, strict security headers, errors without stack traces.</li>
<li>Wrote <code>BACKEND.md</code> with assumptions, call map, capacity estimate and a <b>Test Handoff</b> (12 endpoints, authorization matrix, security cases, integrity cases, load targets).</li></ul>
<h3>premium-ui-expert-v1 → storefront</h3><ul>
<li>Design brief in <code>DESIGN.md</code>: warm ivory palette with its own dark theme, one accent colour, system fonts, calm and confident motion.</li>
<li>Animation modules used: reveal on scroll, hero reveal, <b>click-to-success on Pay</b>, small hover and press effects. <b>Skipped on purpose</b> because there is no real data: sale pings, review shuffle, count-up stats.</li>
<li>Works under a strict security policy (no inline scripts or styles). Cart is a native dialog with focus handling. Rapid "Add to cart" clicks are queued so counts add up.</li>
<li>Every text and background colour pair is checked by a test in light and dark mode.</li></ul>
<h3>tester-expert-v1 → break-it tests, live checks, load test</h3><ul>
<li>Ran the race script (8 parallel payments, one order) and the IDOR script (other users and visitors get 404/401) against the live shop.</li>
<li>Wrote 16 break-it tests: double and repeated payments, Back/refresh, two buyers for the last item, tampered prices, bad quantities, forged cookies, injection-style ids, path tricks, odd Origin headers, rate limits, login lockout.</li>
<li>Checked the real browser: rapid double-click on Add to cart (3 clicks = 3 items) and on Pay (4 clicks = 1 paid order), no horizontal scroll on any page at phone width, dark mode renders.</li>
<li>Found the ${bugCount} bugs below, fixed each at its root, and added tests.</li></ul></section>

<section><h2>3. Bugs the tester found</h2>
<div class="scroll"><table><thead>${row(['ID', 'Severity', 'Area', 'Bug', 'Status'], 'th')}</thead><tbody>${BUGS.map((b) => row([b[0], `<span class="sev">${b[1]}</span>`, b[2], esc(b[3]), '<b class="ok">fixed + tested</b>'])).join('')}</tbody></table></div>
${BUGS.map((b) => `<details><summary>${b[0]} · ${esc(b[3])}</summary><ul><li><b>Steps:</b> ${esc(b[4])}</li><li><b>Root cause:</b> ${esc(b[5]).replace(/`([^`]+)`/g, '<code>$1</code>')}</li><li><b>Fix:</b> ${esc(b[6])}</li><li><b>Proof:</b> ${esc(b[7])}</li></ul></details>`).join('')}
<p class="muted">One failing check was <b>not</b> a bug: <code>//server.mjs</code> returns the shop's home page (200), not the source file. My test expected 404, so I corrected the test and kept the "no source code leaked" check.</p>
<p class="muted">Severity: S1 = money or data loss / security breach, S2 = core flow broken, S3 = works with a workaround, S4 = cosmetic. No S1 was found.</p></section>

<section><h2>4. Security results</h2>
<div class="scroll"><table><thead>${row(['Check', 'Result'], 'th')}</thead><tbody>
${[['Other user reads someone else\'s order', 'Blocked (404); visitors get 401'], ['Reusing a cookie after logout; forged or oversized cookies', 'Always 401'], ['Client-sent price, total, status, user id', 'Ignored; server uses its own prices'], ['Negative, fractional, text, null, huge quantities', 'Rejected with 422'], ['Injection-style product ids and list parameters', '404 / 422, never a 500'], ['Paths outside the public folder (../, encoded, backslash, null byte)', 'No source files served'], ['Cross-site and malformed Origin headers', '403 (after fixing B-02)'], ['Read rate limit; login lockout', '429 with Retry-After; lockout is per account and ignores letter case'], ['Same idempotency key from two users', 'Two separate orders (keys are per user)']].map((r) => row(r.map(esc))).join('')}
</tbody></table></div>
<h3>Known risks (not fixed, by design for a demo)</h3><ul>
<li>Account lockout lets someone lock a known email out for 15 minutes with wrong guesses.</li>
<li>A server crash between "stock reserved" and "payment attempted" leaves a pending order holding stock; needs a clean-up job.</li>
<li>Rate limits live in memory: they reset on restart and do not work across several server processes.</li>
<li>Only tested over plain HTTP; the Secure cookie and HSTS path was not exercised.</li></ul></section>

<section><h2>5. Load test</h2>${loadSection()}</section>

<section><h2>6. Tests</h2>
<p><b>${passed} of ${tests.length}</b> automated tests pass${failed ? `, <b class="bad">${failed} fail</b>` : ''}. They cover the API, break-it cases, colour contrast, and the tester skill's own scripts. Run them with <code>node --test</code> inside <code>demo/shop</code> and at the project root.</p>
<details><summary>All test names</summary><ul>${tests.map((t) => `<li class="${t.ok ? 'ok' : 'bad'}">${t.ok ? '✔' : '✖'} <span style="color:var(--text)">${esc(t.name)}</span></li>`).join('')}</ul></details></section>

<section><h2>7. Git history</h2>
<div class="scroll"><table><thead>${row(['Commit', 'Date', 'Message'], 'th')}</thead><tbody>${log.map((l) => row([`<code>${esc(l[0])}</code>`, esc(l[1]), esc(l[2])])).join('')}</tbody></table></div>
<p class="muted">The first commit was made before this work and holds the first two skills. Everything after it is a separate commit per piece of work. Nothing has been pushed to GitHub.</p></section>

<section><h2>8. Not tested, and what to do next</h2><ul>
<li><b>Real browsers:</b> only the Claude built-in browser was used (desktop, a 375 px phone size, dark mode). Safari, Firefox, screen readers, keyboard-only use and reduced-motion were not tested. Playwright and axe were not installed.</li>
<li><b>Payments and HTTPS:</b> payment is a stub; nothing was tested against a real provider or over HTTPS.</li>
<li><b>Load:</b> one machine, load generator and server sharing the same CPU, no long soak test, no production-size data.</li>
<li><b>Skills themselves:</b> the three skills were exercised on one small project. A second, different project (for example Next.js with a real database) would show how well they generalise.</li>
<li><b>Next:</b> review the commits, then push to GitHub when you are ready; add Playwright and run the browser tests in CI; add a "pending order" clean-up job.</li></ul></section>
</div></body></html>`;

writeFileSync(join(ROOT, 'report', 'work-report.html'), html);
console.log(`Wrote report/work-report.html (${Math.round(statSync(join(ROOT, 'report', 'work-report.html')).size / 1024)} KB): ${passed}/${tests.length} tests, ${log.length} commits, load ${load ? 'included' : 'missing'}`);
