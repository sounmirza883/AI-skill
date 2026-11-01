// Runs the premium-ui-expert-v1 scripts against tiny planted projects. Run: node --test
import { test, before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { scan } from '../skills/premium-ui-expert-v1/scripts/ui-audit.mjs';
import { ratio, checkCss } from '../skills/premium-ui-expert-v1/scripts/contrast-check.mjs';

const run = promisify(execFile);
const script = (name) => fileURLToPath(new URL(`../skills/premium-ui-expert-v1/scripts/${name}`, import.meta.url));
const put = (root, rel, text) => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };
let bad, clean;

before(() => {
  bad = mkdtempSync(join(tmpdir(), 'ui-bad-'));
  put(bad, 'index.html', `<html><head><style>
  .hero h1 { opacity: 0; }
  .card { transition: all 200ms; }
  .bar { transition: width 300ms, opacity 100ms; }
  .btn:hover { color: red; }
  a { outline: none; }
  small { font-size: 10px; }
  .spinner-x { animation: pulse 2s infinite; }
  .grad { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  @keyframes grow { from { height: 0; } to { height: 100px; } }
  </style></head><body class="preloader">
  <div onclick="go()">Buy</div><a>nothing</a><img src="a.png">
  <input name="email"><h1>One</h1><h1>Two</h1>
  <p>Unlock the power of seamless shopping ✨. 23 people are viewing. Lorem ipsum dolor.</p>
  <script>el.animate([{ width: 0 }, { width: 100 }], 300)</script></body></html>`);
  clean = mkdtempSync(join(tmpdir(), 'ui-clean-'));
  put(clean, 'index.html', `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width">
  <style>.card { transition: transform 240ms, opacity 240ms; } @media (hover: hover) { .card:hover { transform: none; } }
  a:focus-visible { outline: 2px solid; } @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
  .js .hero h1 { opacity: 0; }</style></head><body><h1>Handmade lamps</h1>
  <img src="a.png" alt="A lamp" width="400" height="300"><label for="e">Email</label><input id="e" name="email">
  <button type="button">Buy</button><a href="/lamps">Lamps</a></body></html>`);
});
after(() => { rmSync(bad, { recursive: true, force: true }); rmSync(clean, { recursive: true, force: true }); });

test('ui-audit.mjs: finds the planted problems', () => {
  const codes = new Set(scan(bad).map((f) => f.code));
  for (const c of ['HERO_HIDDEN', 'TRANSITION_ALL', 'LAYOUT_ANIMATION', 'HOVER_NO_MEDIA', 'OUTLINE_REMOVED', 'SMALL_TEXT', 'AI_GRADIENT',
    'NO_REDUCED_MOTION', 'PRELOADER', 'CLICKABLE_DIV', 'LINK_NO_HREF', 'IMG_NO_ALT', 'IMG_NO_SIZE', 'INPUT_NO_LABEL', 'VIEWPORT_MISSING',
    'LANG_MISSING', 'H1_COUNT', 'AI_COPY', 'EMOJI_ICON', 'FAKE_PROOF', 'PLACEHOLDER_TEXT']) assert.ok(codes.has(c), `missing ${c}`);
  assert.equal(scan(bad).filter((f) => f.code === 'LAYOUT_ANIMATION').length, 3, 'transition, @keyframes and element.animate');
});

test('ui-audit.mjs: a spinner and a .js-guarded hero are not flagged, a clean page has no findings', () => {
  assert.deepEqual(scan(clean), []);
  const d = mkdtempSync(join(tmpdir(), 'ui-spin-'));
  put(d, 'a.css', '.s { animation: spin 0.7s linear infinite; }\n@media (prefers-reduced-motion: reduce) { .s { animation: none; } }');
  assert.deepEqual(scan(d), []);
  rmSync(d, { recursive: true, force: true });
  assert.ok(scan(bad).some((f) => f.code === 'INFINITE_NO_PAUSE'), 'a non-spinner infinite loop without pause is flagged');
});

test('ui-audit.mjs: scan-ignore silences a reviewed line', () => {
  const d = mkdtempSync(join(tmpdir(), 'ui-ign-'));
  put(d, 'a.css', '.a { transition: width 1s; } /* scan-ignore */\n@media (prefers-reduced-motion: reduce) { .a { transition: none; } }');
  assert.deepEqual(scan(d), []);
  rmSync(d, { recursive: true, force: true });
});

test('ui-audit.mjs CLI: exit 1 on errors, 0 when clean', async () => {
  await assert.rejects(run(process.execPath, [script('ui-audit.mjs'), bad]), (e) => e.code === 1 && /LAYOUT_ANIMATION/.test(e.stdout));
  const ok = await run(process.execPath, [script('ui-audit.mjs'), clean]);
  assert.match(ok.stdout, /0 errors/);
});

test('contrast-check.mjs: ratio and planted pairs', () => {
  assert.ok(ratio('#777777', '#ffffff') < 4.5);
  assert.ok(ratio('#595959', '#ffffff') >= 4.5);
  const css = ':root{--bg:#fff;--text:#595959;--muted:#777;--accent:#0b57d0;--on-accent:#fff}\n@media (prefers-color-scheme: dark){:root{--bg:#111;--text:#eee;--muted:#222}}';
  const { results } = checkCss(css);
  const get = (theme, fg, bg) => results.find((r) => r.theme === theme && r.fg === fg && r.bg === bg);
  assert.equal(get('light', 'text', 'bg').pass, true);
  assert.equal(get('light', 'muted', 'bg').pass, false);
  assert.equal(get('dark', 'muted', 'bg').pass, false, 'dark overrides light');
  assert.equal(get('dark', 'text', 'bg').pass, true);
  assert.ok(get('light', 'on-accent', 'accent'), 'on-X is checked against X');
  assert.equal(checkCss(css, { pairs: [['text', 'bg']] }).results.length, 2);
});

test('contrast-check.mjs CLI: two colours and exit code', async () => {
  const pass = await run(process.execPath, [script('contrast-check.mjs'), '#595959', '#fff']);
  assert.match(pass.stdout, /AA pass/);
  await assert.rejects(run(process.execPath, [script('contrast-check.mjs'), '#777', '#fff']), (e) => e.code === 1 && /AA FAIL/.test(e.stdout));
});
