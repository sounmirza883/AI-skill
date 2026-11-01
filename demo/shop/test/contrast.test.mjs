// Reads public/styles.css and checks the colour pairs the UI actually uses, in light and dark mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const light = vars(css.match(/:root\s*{([^}]*)}/)[1]);
const dark = { ...light, ...vars(css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };

const lum = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const TEXT = [ // [foreground, background] — body-size text needs 4.5:1
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accent', 'bg'], ['accent', 'surface'],
  ['on-accent', 'accent'], ['on-success', 'success'], ['on-danger', 'danger'], ['success', 'surface'], ['danger', 'surface'], ['bg', 'text'],
];
const GRAPHIC = [1, 2, 3, 4, 5, 6].map((n) => ['art', `tone-${n}`]); // product art on its tinted tile needs 3:1

for (const [name, t] of [['light', light], ['dark', dark]]) {
  test(`${name} mode: text pairs reach 4.5:1`, () => {
    for (const [fg, bg] of TEXT) assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${fg} on ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
  });
  test(`${name} mode: product art reaches 3:1 on every tile`, () => {
    for (const [fg, bg] of GRAPHIC) assert.ok(ratio(t[fg], t[bg]) >= 3, `${fg} on ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
  });
}
