#!/usr/bin/env node
// Static audit for the motion, accessibility and "AI look" rules of premium-ui-expert-v1.
// Usage: node ui-audit.mjs <project-dir> [--json]
// Reads html / css / js / jsx / tsx / vue / svelte (CSS inside <style> blocks too). Add "scan-ignore" in a comment on a
// line to silence a finding you have reviewed.
// Regex heuristics, not a browser: it cannot see computed styles, rendered colours, real focus order or animation timing.
// Use it as a fast first pass, then run the human checks in references/qa-checklist.md (devtools, 375px and 1440px, reduced motion).
// Colour contrast has its own tool: contrast-check.mjs.
// Exit code 1 when any error is found.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'reports', 'graphify-out']);
const EXT = new Set(['.html', '.css', '.js', '.mjs', '.jsx', '.tsx', '.ts', '.vue', '.svelte']);
const MARKUP = new Set(['.html', '.jsx', '.tsx', '.vue', '.svelte']);
const isTest = (file) => /(^|\/)(tests?|__tests__)\/|\.(test|spec)\./.test(file);

function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else if (EXT.has(extname(name))) out.push({ file: relative(root, p).replaceAll('\\', '/'), ext: extname(name), text: readFileSync(p, 'utf8') });
  }
  return out;
}

const LAYOUT = 'width|height|min-width|max-width|min-height|max-height|top|left|right|bottom|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|font-size';
const LAYOUT_NAME = new RegExp(`^(?:${LAYOUT})$`);
const LAYOUT_DECL = new RegExp(`(?:^|[;{\\s,\\[])(${LAYOUT})\\s*:`);
const MOTION_DECL = /(?:^|[\s;{])((?:transition|animation)(?:-[a-z-]+)?)\s*:\s*([^;}]+)/g;
const AI_COPY = /unlock the power|elevate your|seamless(?:ly)?|revolutioni[sz]e|in today's fast-paced|supercharge|game-?changer|cutting-edge|next-level/gi;
const FAKE_PROOF = /\b\d+\s+(?:people|others|users|customers|shoppers)\s+(?:are\s+)?(?:viewing|watching|looking)|only\s+\d+\s+left|\b(?:John|Jane)\s+D\./gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}✨⭐⚡❤]/u;

const close = (s, open) => { // index of the brace that closes the one at `open`
  for (let d = 0, i = open; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}' && --d === 0) return i;
  }
  return s.length;
};
const hueSat = (hex) => {
  const h = hex.slice(1), [r, g, b] = (h.length === 3 ? [...h].map((c) => c + c).join('') : h).match(/../g).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return { hue: 0, sat: 0 };
  const hue = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { hue: (hue + 360) % 360, sat: d / (1 - Math.abs(2 * l - 1)) };
};

export function scan(dir) {
  const files = walk(dir).filter((f) => !isTest(f.file));
  const out = [];
  const add = (f, idx, sev, code, msg) => {
    const ls = f.text.lastIndexOf('\n', idx) + 1, le = f.text.indexOf('\n', idx);
    if (/scan-ignore/.test(f.text.slice(ls, le < 0 ? undefined : le))) return;
    out.push({ sev, code, where: `${f.file}:${f.text.slice(0, idx).split('\n').length}`, msg });
  };
  const first = {}; // first location of a project-level fact: [file, index]
  const note = (key, f, idx) => { first[key] ??= [f, idx]; };
  const durations = new Set();
  let gradientText = 0;

  for (const f of files) {
    const segs = f.ext === '.css' ? [{ text: f.text, base: 0 }]
      : ['.html', '.vue', '.svelte'].includes(f.ext) ? [...f.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => ({ text: m[1], base: m.index + m[0].indexOf('>') + 1 })) : [];
    for (const { text, base } of segs) {
      for (const m of text.matchAll(MOTION_DECL)) {
        const [, prop, value] = m, at = base + m.index;
        note('motion', f, at);
        if (prop === 'transition' || prop === 'transition-property') {
          for (const g of value.split(',')) {
            const name = (prop === 'transition' ? g.trim().split(/\s+/)[0] : g.trim());
            if (name === 'all') add(f, at, 'warn', 'TRANSITION_ALL', 'transition: all animates every property, including layout ones: list transform / opacity / the colours you mean');
            else if (LAYOUT_NAME.test(name)) add(f, at, 'error', 'LAYOUT_ANIMATION', `transitions ${name}: animate only transform, opacity, clip-path (layout properties cause reflow and jank)`);
          }
        }
        if (/\binfinite\b/.test(value) && !/\b(?:spin|spinner|loading|loader|rotate)\b/.test(value)) note('infinite', f, at); // loading spinners are short and essential
        for (const d of value.replace(/var\([^)]*\)/g, '').matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
          const ms = Math.round(parseFloat(d[1]) * (d[2] === 's' ? 1000 : 1));
          if (ms) durations.add(ms);
        }
      }
      for (const k of text.matchAll(/@keyframes\s+[\w-]+\s*\{/g)) {
        note('motion', f, base + k.index);
        const body = text.slice(k.index, close(text, k.index + k[0].length - 1));
        const bad = LAYOUT_DECL.exec(body);
        if (bad) add(f, base + k.index, 'error', 'LAYOUT_ANIMATION', `@keyframes animates ${bad[1]}: animate only transform, opacity, clip-path`);
      }
      for (const m of text.matchAll(/:hover/g)) note('hover', f, base + m.index);
      for (const m of text.matchAll(/outline\s*:\s*(?:none|0)\b/g)) note('outline', f, base + m.index);
      for (const m of text.matchAll(/font-size\s*:\s*(\d*\.?\d+)px/g)) {
        if (parseFloat(m[1]) < 12) add(f, base + m.index, 'warn', 'SMALL_TEXT', `font-size ${m[1]}px is below 12px: hard to read, especially on phones`);
      }
      for (const m of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
        // a `.js ...` selector only applies once a script ran, so the no-JS page stays visible: that is the recommended pattern
        if (/hero|(?:^|[\s,>+~])h1\b|\[data-hero/i.test(m[1]) && !/(?:^|\s)\.js\s/.test(m[1]) && /opacity\s*:\s*0\s*(?:;|$|!)/.test(m[2])) {
          add(f, base + m.index, 'warn', 'HERO_HIDDEN', 'hero/h1 starts at opacity 0: LCP/SEO risk. The content must be visible without JS and the whole reveal must finish in 1.2s or less (seo-expert-v1 references/ui-ux-for-seo.md)');
        }
      }
      for (const m of text.matchAll(/-gradient\([^;{}]*/g)) {
        const purple = [...m[0].matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)].some((c) => { const { hue, sat } = hueSat(c[0]); return hue >= 245 && hue <= 300 && sat >= 0.35; });
        if (purple) add(f, base + m.index, 'warn', 'AI_GRADIENT', 'purple/indigo gradient is the default AI look: pick colours from the brand, not the template');
      }
    }
    for (const m of f.text.matchAll(/(?<![-\w])background-clip\s*:\s*text|text-transparent/g)) { gradientText++; note('gradientText', f, m.index); }
    for (const m of f.text.matchAll(/\b(?:from|via|to)-(?:indigo|violet|purple|fuchsia)-\d{2,3}\b/g)) {
      add(f, m.index, 'warn', 'AI_GRADIENT', `Tailwind ${m[0]} is the default AI palette: use brand colours`);
    }
    for (const m of f.text.matchAll(/(?:class(?:Name)?\s*=\s*["'][^"']*|\.)(preloader|page-loader|splash(?:-screen)?)\b/g)) {
      add(f, m.index, 'warn', 'PRELOADER', `"${m[1]}" blocks the first paint: LCP/SEO risk on pages that must rank; show content first`);
    }
    for (const m of f.text.matchAll(/\.animate\(\s*(\[[\s\S]{0,400}?\]|\{[\s\S]{0,300}?\})/g)) {
      const bad = LAYOUT_DECL.exec(m[1]);
      if (bad) add(f, m.index, 'error', 'LAYOUT_ANIMATION', `element.animate() animates ${bad[1]}: animate only transform, opacity, clip-path`);
      note('motion', f, m.index);
    }
    for (const m of f.text.matchAll(/prefers-reduced-motion/g)) note('reduced', f, m.index);
    for (const m of f.text.matchAll(/data-motion|animation-play-state/g)) note('pause', f, m.index);
    for (const m of f.text.matchAll(/hover:\s*hover/g)) note('hoverMedia', f, m.index);
    for (const m of f.text.matchAll(/:focus-visible/g)) note('focusVisible', f, m.index);

    if (f.ext !== '.css') {
      for (const m of f.text.matchAll(/lorem ipsum/gi)) add(f, m.index, 'error', 'PLACEHOLDER_TEXT', 'lorem ipsum left in the page: write the real copy');
      for (const m of f.text.matchAll(AI_COPY)) add(f, m.index, 'warn', 'AI_COPY', `"${m[0]}" is generic AI-sounding copy: say something specific with real numbers or names`);
      for (const m of f.text.matchAll(FAKE_PROOF)) add(f, m.index, 'warn', 'FAKE_PROOF', `"${m[0]}" looks like fake urgency or social proof: use real data or remove it`);
    }
    if (MARKUP.has(f.ext)) {
      f.text.split('\n').forEach((ln, n, all) => {
        if (EMOJI.test(ln)) add(f, all.slice(0, n).join('\n').length + (n ? 1 : 0), 'warn', 'EMOJI_ICON', 'emoji used as an icon: use one consistent icon set (SVG)');
      });
      for (const m of f.text.matchAll(/<img\b[^>]*>/g)) {
        if (!/\balt\s*=/.test(m[0])) add(f, m.index, 'error', 'IMG_NO_ALT', '<img> without alt: meaningful text, or alt="" if decorative');
        if (!(/\bwidth\s*=/.test(m[0]) && /\bheight\s*=/.test(m[0]))) add(f, m.index, 'warn', 'IMG_NO_SIZE', '<img> without width and height: causes layout shift (CLS)');
      }
      for (const m of f.text.matchAll(/<(?:div|span)\b[^>]*(?:\bonclick\s*=|\bonClick\s*=|\brole\s*=\s*["']button["'])/g)) {
        add(f, m.index, 'warn', 'CLICKABLE_DIV', 'clickable div/span: use <button> (keyboard, focus and screen-reader support for free)');
      }
      for (const m of f.text.matchAll(/<a(?=[\s>])(?![^>]*\bhref)[^>]*>/g)) add(f, m.index, 'warn', 'LINK_NO_HREF', '<a> without href is not focusable or crawlable: use a <button> for actions');
      const forIds = new Set([...f.text.matchAll(/<label\b[^>]*\b(?:for|htmlFor)\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
      const labels = [...f.text.matchAll(/<label\b[\s\S]*?<\/label>/g)].map((m) => [m.index, m.index + m[0].length]);
      for (const m of f.text.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
        if (/\btype\s*=\s*["'](?:hidden|submit|button|reset|image)["']/.test(m[0])) continue;
        const id = /\bid\s*=\s*["']([^"']+)["']/.exec(m[0])?.[1];
        if (!/aria-label(?:ledby)?\s*=/.test(m[0]) && !(id && forIds.has(id)) && !labels.some(([a, b]) => m.index > a && m.index < b)) {
          add(f, m.index, 'warn', 'INPUT_NO_LABEL', 'form field without a label: add <label for>, wrap it in <label>, or use aria-label');
        }
      }
    }
    if (f.ext === '.html') {
      if (/<head[\s>]/.test(f.text) && !/<meta[^>]*name\s*=\s*["']viewport["']/.test(f.text)) add(f, 0, 'error', 'VIEWPORT_MISSING', 'no <meta name="viewport">: the page will not be responsive on phones');
      const html = /<html\b[^>]*>/.exec(f.text);
      if (html && !/\blang\s*=/.test(html[0])) add(f, html.index, 'error', 'LANG_MISSING', '<html> without lang: screen readers and search engines need the language');
      if (/<body[\s>]/.test(f.text)) {
        const h1 = (f.text.match(/<h1[\s>]/g) || []).length;
        if (h1 !== 1) add(f, 0, 'warn', 'H1_COUNT', `${h1} <h1> in the HTML (want exactly 1; a heading added later by JS does not count for crawlers)`);
      }
    }
  }

  const at = (key, sev, code, msg) => { if (first[key]) add(first[key][0], first[key][1], sev, code, msg); };
  if (first.motion && !first.reduced) at('motion', 'error', 'NO_REDUCED_MOTION', 'animation without any prefers-reduced-motion handling: reduced motion must remove movement and show final states');
  if (first.infinite && !first.pause) at('infinite', 'warn', 'INFINITE_NO_PAUSE', 'infinite animation with no pause control (data-motion / animation-play-state): loops over 5s need a pause (WCAG 2.2.2)');
  if (durations.size > 5) out.push({ sev: 'warn', code: 'DURATION_SPRAWL', where: '-', msg: `${durations.size} different literal durations (${[...durations].sort((a, b) => a - b).join(', ')} ms): use the motion tokens (120/240/480/800 ms)` });
  if (first.hover && !first.hoverMedia) at('hover', 'warn', 'HOVER_NO_MEDIA', ':hover without @media (hover: hover): touch devices get stuck hover states');
  if (first.outline && !first.focusVisible) at('outline', 'error', 'OUTLINE_REMOVED', 'outline removed and no :focus-visible style anywhere: keyboard users lose the focus ring');
  if (gradientText >= 3) at('gradientText', 'warn', 'GRADIENT_TEXT', `gradient text used ${gradientText} times: it is an AI-look marker, keep it for at most one headline`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, flag] = process.argv.slice(2);
  if (!dir) { console.error('Usage: node ui-audit.mjs <project-dir> [--json]'); process.exit(2); }
  const findings = scan(dir);
  if (flag === '--json') console.log(JSON.stringify(findings, null, 2));
  else {
    const rank = { error: 0, warn: 1, info: 2 };
    for (const x of findings.sort((a, b) => rank[a.sev] - rank[b.sev])) console.log(`${x.sev.toUpperCase().padEnd(5)} ${x.code.padEnd(18)} ${x.where}  ${x.msg}`);
    const n = (s) => findings.filter((x) => x.sev === s).length;
    console.log(`\n${n('error')} errors, ${n('warn')} warnings. Heuristic scan: finish with the browser checks in references/qa-checklist.md.`);
  }
  process.exitCode = findings.some((x) => x.sev === 'error') ? 1 : 0;
}
