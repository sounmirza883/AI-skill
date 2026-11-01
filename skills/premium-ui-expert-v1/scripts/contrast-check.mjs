#!/usr/bin/env node
// WCAG contrast checker for the colour tokens of a stylesheet, in light and dark mode.
// Usage: node contrast-check.mjs <file.css> [--pairs text:bg,muted:surface] [--min 4.5]
//        node contrast-check.mjs '#6B655C' '#FAF8F4'      (two colours: prints the ratio and the AA / AA-large / AAA verdict)
// Reads --custom-properties from the top-level :root (light) and from dark blocks (@media (prefers-color-scheme: dark),
// [data-theme=dark], .dark); dark = light overridden by the dark values. Resolves one level of var(--x).
// Auto pairs: text-like names (text, muted, accent, primary, success, danger...) against background-like names
// (bg, surface, card...), and on-X against X. --pairs replaces the auto pairs. Only #rgb / #rrggbb values are checked.
// Heuristic: it checks the pairs you declare, not what the page really renders (gradients, images, opacity). Check those in the browser.
// Exit code 1 when a pair fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FG = /^(text|fg|foreground|ink|muted|subtle|accent|primary|link|success|danger|warning|error|info)(-.*)?$/;
const BG = /^(bg|background|surface|canvas|card|page|base|paper|panel)(-.*)?$/;

const rgb = (hex) => {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex?.trim())?.[1];
  if (!h) return null;
  return (h.length === 3 ? [...h].map((c) => c + c).join('') : h).match(/../g).map((x) => parseInt(x, 16));
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const close = (css, open) => { // index of the brace that closes the one at `open`
  for (let d = 0, i = open; i < css.length; i++) {
    if (css[i] === '{') d++;
    else if (css[i] === '}' && --d === 0) return i;
  }
  return css.length;
};
const decls = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].trim()]));

export function themes(css) {
  const dark = [];
  for (const m of css.matchAll(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{|\[data-theme=["']?dark["']?\][^{]*\{|\.dark\b[^{]*\{/g)) {
    dark.push([m.index, close(css, m.index + m[0].length - 1)]);
  }
  let light = {};
  for (const m of css.matchAll(/:root\s*\{/g)) {
    if (dark.some(([a, b]) => m.index > a && m.index < b)) continue;
    light = { ...light, ...decls(css.slice(m.index, close(css, m.index + m[0].length - 1))) };
  }
  const over = dark.reduce((acc, [a, b]) => ({ ...acc, ...decls(css.slice(a, b)) }), {});
  const resolve = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.replace(/^var\(--([\w-]+)\)$/, (_, n) => t[n] ?? v)]));
  return { light: resolve(light), dark: resolve({ ...light, ...over }) };
}

export function checkCss(css, { pairs, min = 4.5 } = {}) {
  const t = themes(css), results = [], notes = [];
  for (const theme of ['light', 'dark']) {
    const v = t[theme], names = Object.keys(v);
    const list = pairs ?? [
      ...names.filter((n) => FG.test(n)).flatMap((f) => names.filter((n) => BG.test(n)).map((b) => [f, b])),
      ...names.filter((n) => n.startsWith('on-') && v[n.slice(3)]).map((n) => [n, n.slice(3)]),
    ];
    for (const [fg, bg] of list) {
      if (!rgb(v[fg]) || !rgb(v[bg])) { if (v[fg] || v[bg]) notes.push(`${theme}: skipped ${fg} on ${bg} (not a #rgb/#rrggbb value)`); continue; }
      const r = ratio(v[fg], v[bg]);
      results.push({ theme, fg, bg, ratio: Math.round(r * 100) / 100, min, pass: r >= min });
    }
  }
  if (!results.length) notes.push('no colour pairs found: pass --pairs fg:bg using your token names');
  return { results, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0]?.startsWith('#') && args[1]?.startsWith('#')) {
    if (!rgb(args[0]) || !rgb(args[1])) { console.error('Colours must be #rgb or #rrggbb'); process.exit(2); }
    const r = ratio(args[0], args[1]);
    console.log(`${r.toFixed(2)}:1  AA ${r >= 4.5 ? 'pass' : 'FAIL'}  AA-large/UI ${r >= 3 ? 'pass' : 'FAIL'}  AAA ${r >= 7 ? 'pass' : 'FAIL'}`);
    process.exitCode = r >= 4.5 ? 0 : 1;
  } else {
    const opt = (k) => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
    if (!args[0] || args[0].startsWith('--')) { console.error('Usage: node contrast-check.mjs <file.css> [--pairs fg:bg,...] [--min 4.5]  |  node contrast-check.mjs <#fg> <#bg>'); process.exit(2); }
    const pairs = opt('--pairs')?.split(',').map((p) => p.split(':'));
    const { results, notes } = checkCss(readFileSync(args[0], 'utf8'), { pairs, min: Number(opt('--min') ?? 4.5) });
    for (const r of results) console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.theme.padEnd(5)} ${r.fg} on ${r.bg} = ${r.ratio}:1 (needs ${r.min})`);
    for (const n of notes) console.log(`note  ${n}`);
    const fails = results.filter((r) => !r.pass).length;
    console.log(`\n${results.length - fails} pass, ${fails} fail`);
    process.exitCode = fails || !results.length ? 1 : 0;
  }
}
