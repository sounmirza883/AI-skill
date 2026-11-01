# Animation Recipes

Every recipe has: **Job** (why it exists), **Use / Skip**, **Spec** (timing), **Code** (vanilla,
framework-free), and **A11y**. Port to the project's stack with the notes at the end.
Colors and sizes use tokens: `--bg`, `--surface`, `--text`, `--muted`, `--border`,
`--accent`, `--success`, `--danger`, `--shadow-3`. Rename to the project's tokens.

---

## 0. Foundation (include once)

```html
<!-- In <head>, before CSS loads: lets CSS hide things only when JS will reveal them -->
<script>document.documentElement.classList.add('js')</script>
```

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-3: 480ms;
  --stagger: 60ms;
}

.js [data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity var(--dur-3) var(--ease-out), transform var(--dur-3) var(--ease-out);
  transition-delay: calc(var(--i, 0) * var(--stagger));
}
.js [data-reveal].is-in { opacity: 1; transform: none; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```js
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Every looping animation checks this before each tick (WCAG 2.2.2 pause control).
const motionPaused = () => reduceMotion || document.documentElement.dataset.motion === 'paused';

// [data-reveal] fades/rises in; [data-inview] only gets the .is-in class (for custom CSS).
const revealObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    revealObserver.unobserve(e.target); // reveal once
  }
}, { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('[data-reveal], [data-inview]').forEach((el) => revealObserver.observe(el));

// Global pause toggle: <button data-motion-toggle aria-pressed="false">Pause animations</button>
document.querySelector('[data-motion-toggle]')?.addEventListener('click', (e) => {
  const paused = document.documentElement.dataset.motion !== 'paused';
  document.documentElement.dataset.motion = paused ? 'paused' : '';
  e.currentTarget.setAttribute('aria-pressed', String(paused));
});
```

Stagger siblings with `style="--i:0"`, `--i:1`, ... The `.js` prefix means content stays visible if JS fails.

---

## 1. Preloader / page intro

**Job:** builds anticipation and frames the brand before the peak moment. Hides font/image pop-in.
**Use:** asset-heavy heroes (video, WebGL, big imagery), creative studios, launches.
**Skip:** SaaS apps, e-commerce, anything where speed is the brand. Use skeleton screens in app UIs instead.

**Spec:** progress tied to *real* loading (fonts + critical images), never a fake timer. Max 2.5s hard cap.
Exit with a clip-path wipe (700ms, ease-in-out) that hands off directly into the hero reveal.
Show only once per session.

```html
<div class="preloader" aria-hidden="true">
  <span class="preloader__mark">Brand</span>
  <span class="preloader__bar"></span>
</div>
```

```css
.preloader {
  position: fixed; inset: 0; z-index: 100;
  display: grid; place-items: center;
  background: var(--bg); color: var(--text);
  clip-path: inset(0 0 0 0);
  transition: clip-path 0.7s var(--ease-in-out);
}
.preloader.is-done { clip-path: inset(0 0 100% 0); }
.preloader__mark { font-size: clamp(1.5rem, 4vw, 3rem); letter-spacing: -0.02em; }
.preloader__bar {
  position: absolute; left: 0; bottom: 0; width: 100%; height: 2px;
  background: var(--accent); transform-origin: left;
  transform: scaleX(var(--p, 0)); transition: transform 0.3s var(--ease-out);
}
```

```js
const pre = document.querySelector('.preloader');
const finishIntro = () => document.documentElement.classList.add('is-loaded'); // hero reveal keys off this
let seen = false;
try { seen = sessionStorage.getItem('intro-seen') === '1'; sessionStorage.setItem('intro-seen', '1'); } catch {}

if (!pre || seen || reduceMotion) {
  pre?.remove();
  requestAnimationFrame(finishIntro);
} else {
  const critical = [document.fonts.ready, ...[...document.querySelectorAll('img[data-critical]')]
    .map((img) => img.decode().catch(() => {}))];
  let done = 0;
  critical.forEach((p) => p.then(() => pre.style.setProperty('--p', ++done / critical.length)));
  Promise.race([Promise.all(critical), new Promise((r) => setTimeout(r, 2500))]).then(() => {
    pre.classList.add('is-done');
    finishIntro();
    pre.addEventListener('transitionend', () => pre.remove(), { once: true });
  });
}
```

**A11y:** `aria-hidden` (decorative). Never trap focus. Real content is in the DOM underneath from the start.

---

## 2. Hero reveal

**Job:** the peak first impression. Says "every pixel here was considered".
**Use:** every marketing site. **Skip:** app dashboards.

**Spec (Confident):** eyebrow 0ms → headline words rise from a mask, 40ms stagger, 900ms each →
subhead +250ms → CTAs +350ms → hero visual scales 1.04 → 1 with fade, +400ms. Total ≤ 1.2s.

```html
<section class="hero">
  <p data-hero style="--d:0ms">For growing clinics</p>
  <h1 data-split>Patient bookings that run themselves</h1>
  <p data-hero style="--d:250ms">One calendar, automatic reminders, zero no-shows.</p>
  <div data-hero style="--d:350ms"><a class="btn" href="/start">Start free</a></div>
  <img data-hero class="hero__visual" style="--d:400ms" src="app.webp" alt="Booking calendar with weekly appointments" fetchpriority="high">
</section>
```

```css
.w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.08em; }
.w > span {
  display: inline-block; transform: translateY(110%);
  transition: transform 0.9s var(--ease-out);
  transition-delay: calc(var(--i) * 40ms + 100ms);
}
.is-loaded .w > span { transform: none; }

.js .hero [data-hero] {
  opacity: 0; transform: translateY(12px);
  transition: opacity 0.8s var(--ease-out), transform 0.8s var(--ease-out);
  transition-delay: var(--d, 0ms);
}
.js .hero .hero__visual { transform: scale(1.04); }
.is-loaded .hero [data-hero] { opacity: 1; transform: none; }
```

```js
// Split headings into masked words. Built with DOM nodes (no innerHTML) so text is never parsed as HTML.
document.querySelectorAll('[data-split]').forEach((el) => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.replaceChildren(...text.split(/\s+/).flatMap((word, i) => {
    const outer = document.createElement('span');
    outer.className = 'w';
    outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = word;
    inner.style.setProperty('--i', i);
    outer.append(inner);
    return [outer, ' '];
  }));
});
// No preloader on the page? Start the hero on the next frame:
if (!document.querySelector('.preloader')) requestAnimationFrame(() => document.documentElement.classList.add('is-loaded'));
```

**A11y / perf:** `aria-label` keeps the heading readable as one phrase. The hero headline is often
the LCP element: Chrome ignores `opacity: 0` elements for LCP, so the words animate `transform` only
(no opacity) and start immediately. In frameworks, split words at render time instead of in JS to
avoid a hydration flash.

---

## 3. Word rotator

**Job:** curiosity + personal relevance ("Built for *founders* / *designers* / *agencies*"). Lets one headline speak to several audiences.
**Use:** hero subheads, section titles. **Skip:** more than one per page; legal/finance (feels unserious).

**Spec:** 2.4s per word, vertical slide 600ms ease-out, accent color. Width = longest word (no layout shift).

```html
<h2>Built for
  <span class="rotator" aria-hidden="true"><span>founders</span><span>designers</span><span>agencies</span></span>
  <span class="sr-only">founders, designers and agencies</span>
</h2>
```

```css
/* All words share one grid cell, so the slot is as wide as the longest word. */
.rotator { display: inline-grid; vertical-align: bottom; overflow: hidden; height: 1.2em; line-height: 1.2; color: var(--accent); }
.rotator > span {
  grid-area: 1 / 1; transform: translateY(100%); opacity: 0;
  transition: transform 0.6s var(--ease-out), opacity 0.6s var(--ease-out);
}
.rotator > span.is-active { transform: none; opacity: 1; }
.rotator > span.is-leaving { transform: translateY(-100%); opacity: 0; }
```

```js
document.querySelectorAll('.rotator').forEach((rot) => {
  const words = [...rot.children];
  let i = 0;
  words[0].classList.add('is-active');
  setInterval(() => {
    if (motionPaused() || document.hidden) return;
    const prev = words[i];
    prev.classList.replace('is-active', 'is-leaving');
    setTimeout(() => prev.classList.remove('is-leaving'), 600);
    i = (i + 1) % words.length;
    words[i].classList.add('is-active');
  }, 2400);
});
```

**A11y:** screen readers get the full sentence once via `.sr-only`; the moving part is hidden. Respects the global pause.

---

## 4. Live activity pings ("sale pings")

**Job:** social proof and momentum — "real people are buying right now".
**Use:** only with a **real** event feed (orders, sign-ups) from the backend. **Skip:** no real data → do not build it. Never fabricate names, cities or times.

**Spec:** first ping after 8s, then every 20–35s, max 5 per session, visible 5s, bottom-left,
dismissible forever. Slide up 500ms + pulsing dot. Hide on mobile while a form field is focused.

```html
<aside class="ping" aria-live="off">
  <span class="ping__dot" aria-hidden="true"></span>
  <p class="ping__text"></p>
  <button class="ping__close" aria-label="Hide activity notifications">×</button>
</aside>
```

```css
.ping {
  position: fixed; left: 16px; bottom: 16px; z-index: 50; max-width: min(360px, calc(100vw - 32px));
  display: flex; gap: 12px; align-items: center; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-3);
  transform: translateY(calc(100% + 24px)); opacity: 0;
  transition: transform 0.5s var(--ease-out), opacity 0.5s var(--ease-out);
}
.ping.is-in { transform: none; opacity: 1; }
.ping__dot { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
.ping__dot::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: inherit; animation: ping 1.6s var(--ease-out) infinite; }
@keyframes ping { to { transform: scale(3); opacity: 0; } }
@media (max-width: 640px) { body:has(input:focus, textarea:focus, select:focus) .ping { display: none; } }
```

```js
async function startPings() {
  const el = document.querySelector('.ping');
  if (!el) return;
  // Expected shape: [{ name: "Ayesha", city: "Lahore", action: "bought the Pro plan", ago: "4 min ago" }]
  const items = await fetch('/api/recent-activity').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  if (!items.length) return; // no real data → no pings
  let dismissed = false;
  try { dismissed = localStorage.getItem('pings-off') === '1'; } catch {}
  if (dismissed) return;
  el.querySelector('.ping__close').addEventListener('click', () => {
    dismissed = true; el.classList.remove('is-in');
    try { localStorage.setItem('pings-off', '1'); } catch {}
  });
  const max = Math.min(items.length, 5);
  let n = 0;
  const show = () => {
    if (dismissed || n >= max) return;
    if (document.hidden || motionPaused()) return setTimeout(show, 5000);
    const it = items[n++];
    el.querySelector('.ping__text').textContent = `${it.name} from ${it.city} ${it.action} · ${it.ago}`;
    el.classList.add('is-in');
    setTimeout(() => el.classList.remove('is-in'), 5000);
    setTimeout(show, 20000 + Math.random() * 15000);
  };
  setTimeout(show, 8000);
}
startPings();
```

**A11y / privacy:** `aria-live="off"` so screen readers are not interrupted by marketing. Use first name + city only, with customer consent.

---

## 5. Review shuffle

**Job:** trust from many voices, delivered one at a time so each is read. The deck physically suggests "there are many more".
**Use:** 4+ real reviews. **Skip:** fewer than 3 reviews — show them as a simple grid.

**Spec:** stacked deck, each back card 12px lower and 4% smaller. Every 6s (or on "Next"), the top card flies right
with an 8° tilt (450ms) and returns to the back. Pause on hover/focus.

```html
<div class="deck-wrap">
  <div class="deck">
    <figure class="card">
      <blockquote>"We cut onboarding time from 3 weeks to 4 days."</blockquote>
      <figcaption>Sara Malik · Ops Lead, Northwind Clinics</figcaption>
    </figure>
    <!-- more real reviews -->
  </div>
  <button class="deck__next">Next review</button>
</div>
```

```css
.deck { display: grid; padding-bottom: 40px; }
.deck > .card {
  grid-area: 1 / 1; padding: 28px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border);
  transform: translateY(calc(var(--pos) * 12px)) scale(calc(1 - var(--pos) * 0.04));
  opacity: calc(1 - var(--pos) * 0.3);
  z-index: calc(10 - var(--pos));
  transition: transform 0.6s var(--ease-out), opacity 0.6s var(--ease-out);
}
.deck > .card.is-out { transform: translateX(110%) rotate(8deg); opacity: 0; transition-duration: 0.45s; }
```

```js
document.querySelectorAll('.deck-wrap').forEach((wrap) => {
  const deck = wrap.querySelector('.deck');
  let cards = [...deck.children];
  let hover = false;
  const layout = () => cards.forEach((c, i) => { c.style.setProperty('--pos', i); c.inert = i > 0; });
  const next = () => {
    const top = cards[0];
    top.classList.add('is-out');
    setTimeout(() => { top.classList.remove('is-out'); cards = [...cards.slice(1), top]; layout(); }, 450);
  };
  layout();
  wrap.querySelector('.deck__next').addEventListener('click', next);
  wrap.addEventListener('pointerenter', () => (hover = true));
  wrap.addEventListener('pointerleave', () => (hover = false));
  setInterval(() => { if (!hover && !motionPaused() && !document.hidden && !wrap.contains(document.activeElement)) next(); }, 6000);
});
```

**A11y:** only the top card is reachable (`inert` on the rest); the Next button gives keyboard control. Every review has a real name, role and company; link to the source (Google, G2, Trustpilot) when possible.

---

## 6. Count-up stats

**Job:** credibility. A number that "arrives" gets read; a static number gets skimmed.
**Use:** 3–4 real, specific numbers ("12,480 clinics", "4.9/5", "38% fewer no-shows"). **Skip:** vague or invented numbers.

**Spec:** starts when 60% visible, 1.6s, ease-out-quart, tabular figures so width never jumps.
Final value is in the HTML (SEO, no-JS, reduced motion).

```html
<p class="stat"><span data-count="12480" data-suffix="+">12,480+</span> clinics</p>
<p class="stat"><span data-count="4.9" data-suffix="/5">4.9/5</span> average rating</p>
```

```css
[data-count] { font-variant-numeric: tabular-nums; }
```

```js
const countObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    countObserver.unobserve(e.target);
    if (reduceMotion) continue; // final value already in HTML
    const el = e.target;
    const end = Number(el.dataset.count);
    const decimals = (el.dataset.count.split('.')[1] || '').length;
    const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now(), dur = 1600;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = fmt.format(end * (1 - (1 - p) ** 4)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => countObserver.observe(el));
```

---

## 7. Bento build

**Job:** shows feature richness without a wall of text. The staggered "assembly" says "everything fits together".
**Use:** feature overviews (4–7 tiles). **Skip:** more than 8 tiles; tiles without a visual.

**Spec:** tiles rise 24px + scale 0.96 → 1, 70ms stagger in reading order. Each tile's inner demo
(chart, toggle, mini-UI) starts 300ms after its tile lands. Cursor spotlight on hover (desktop).

```html
<section class="bento">
  <article data-reveal style="--i:0">…</article>
  <article data-reveal style="--i:1">…</article>
  <!-- … -->
</section>
```

```css
.bento { display: grid; gap: 16px; grid-template-columns: repeat(6, 1fr); grid-auto-rows: minmax(200px, auto); }
.bento > :nth-child(1) { grid-column: span 4; grid-row: span 2; }
.bento > :nth-child(2), .bento > :nth-child(3) { grid-column: span 2; }
.bento > :nth-child(4), .bento > :nth-child(5), .bento > :nth-child(6) { grid-column: span 2; }
@media (max-width: 768px) {
  .bento { grid-template-columns: 1fr; }
  .bento > * { grid-column: auto !important; grid-row: auto !important; }
}

.bento > * { position: relative; overflow: hidden; padding: 24px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); }
.js .bento > [data-reveal] { transform: translateY(24px) scale(0.96); --stagger: 70ms; }
.js .bento > [data-reveal].is-in { transform: none; }

@media (hover: hover) and (pointer: fine) {
  .bento > *::before {
    content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.3s;
    background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklch, var(--accent) 12%, transparent), transparent 45%);
  }
  .bento > *:hover::before { opacity: 1; }
}
```

```js
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.bento > *').forEach((tile) => tile.addEventListener('pointermove', (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
    tile.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
}
```

Start inner demos from the tile's `transitionend` or by listening for `.is-in` with `[data-inview]`.

---

## 8. Cursor tour

**Job:** "show, don't tell". A fake cursor walks through the product, clicking the key steps. Visitors understand the product without reading.
**Use:** product hero or "How it works" for SaaS/tools. **Skip:** no real product UI to show.

**Spec:** cursor moves between waypoints (900ms ease-in-out), click = scale 0.85 + ripple, label chip
follows the cursor, pause 900ms per step, loop. Runs only while ≥40% visible. Reduced motion → static
screenshot with numbered annotations.

```html
<div class="tour" data-tour='[{"x":14,"y":22,"label":"Pick a template"},{"x":62,"y":40,"click":true,"label":"Drag to customise"},{"x":82,"y":84,"click":true,"label":"Publish"}]'>
  <img src="editor.webp" alt="Editor with a template selected and a Publish button">
  <div class="tour__cursor" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 2l6 16 2.5-6.5L17 9z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>
    <span class="tour__label"></span>
  </div>
</div>
```

```css
.tour { position: relative; border-radius: 16px; overflow: hidden; }
.tour img { display: block; width: 100%; height: auto; }
.tour__cursor { position: absolute; left: 0; top: 0; display: flex; gap: 6px; align-items: flex-start; pointer-events: none; }
.tour__cursor svg { transition: transform 0.15s var(--ease-out); filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.3)); }
.tour__cursor.is-click svg { transform: scale(0.85); }
.tour__label { margin-top: 14px; padding: 4px 8px; border-radius: 999px; font-size: 12px; background: var(--accent); color: var(--bg); white-space: nowrap; }
.tour__label:empty { display: none; }
```

```js
document.querySelectorAll('[data-tour]').forEach((tour) => {
  const steps = JSON.parse(tour.dataset.tour);
  const cursor = tour.querySelector('.tour__cursor');
  const label = cursor.querySelector('.tour__label');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let visible = false, looping = false, i = 0;

  async function loop() {
    if (looping) return; // one loop at a time, even if visibility flips quickly
    looping = true;
    while (visible && !motionPaused()) {
      const s = steps[i];
      const { width, height } = tour.getBoundingClientRect(); // re-read each step: survives resizes
      label.textContent = s.label || '';
      await cursor.animate(
        [{ transform: `translate(${(s.x / 100) * width}px, ${(s.y / 100) * height}px)` }],
        { duration: 900, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }
      ).finished;
      if (s.click) {
        cursor.classList.add('is-click');
        tour.dispatchEvent(new CustomEvent('tour:click', { detail: i })); // let the demo UI react
        await wait(200);
        cursor.classList.remove('is-click');
      }
      await wait(s.pause ?? 900);
      i = (i + 1) % steps.length;
    }
    looping = false;
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0.4 }).observe(tour);
});
```

Best version: instead of a static screenshot, build a lightweight HTML mock of the UI and react to `tour:click` (open a menu, toggle a switch) so the "app" actually responds.

---

## 9. Process draw

**Job:** "they have a method". A line drawing through numbered steps turns a list into a journey.
**Use:** "How we work", onboarding steps, timelines (3–6 steps). **Skip:** single-step processes.

**Spec:** line draws as the section scrolls through the viewport (scroll-linked where supported,
otherwise a 1.6s draw on enter). Steps reveal with the foundation stagger. Vertical on mobile.

```html
<section class="process" data-inview>
  <svg class="process__line" viewBox="0 0 4 400" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 0 V400" pathLength="1" />
  </svg>
  <ol>
    <li data-reveal style="--i:0"><h3>Discovery call</h3><p>…</p></li>
    <li data-reveal style="--i:1"><h3>Design sprint</h3><p>…</p></li>
    <li data-reveal style="--i:2"><h3>Build & launch</h3><p>…</p></li>
  </ol>
</section>
```

```css
.process { position: relative; padding-left: 56px; view-timeline-name: --process; }
.process__line { position: absolute; left: 22px; top: 0; width: 4px; height: 100%; overflow: visible; }
.process__line path {
  fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke;
  stroke-dasharray: 1; stroke-dashoffset: 1;
}
@supports (animation-timeline: view()) {
  .process__line path { animation: draw linear both; animation-timeline: --process; animation-range: cover 15% cover 70%; }
}
@supports not (animation-timeline: view()) {
  .process__line path { transition: stroke-dashoffset 1.6s var(--ease-in-out); }
  .process.is-in .process__line path { stroke-dashoffset: 0; }
}
@keyframes draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .process__line path { animation: none; stroke-dashoffset: 0; } }
```

For a curvy desktop path, draw the curve in Figma, export the `d` attribute, keep `pathLength="1"`. Use a straight vertical line under 768px.

---

## 10. Before / after

**Job:** makes the transformation tangible — the visitor *does* the reveal, so they own the conclusion.
**Use:** renovation, design, retouching, cleaning, SEO graphs, redesigns. **Skip:** the difference is subtle.

**Spec:** native range input (free keyboard + touch support), clip-path on the "after" image.
On first view, the handle nudges 50% → 38% → 50% (1.2s) to show it's draggable.

```html
<div class="ba" style="--pos: 50%">
  <img src="before.webp" alt="Kitchen before renovation: dark cabinets, old tiles">
  <img class="ba__after" src="after.webp" alt="Kitchen after renovation: white oak cabinets, open shelving">
  <span class="ba__tag ba__tag--l">Before</span><span class="ba__tag ba__tag--r">After</span>
  <div class="ba__handle" aria-hidden="true"></div>
  <input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after">
</div>
```

```css
.ba { position: relative; overflow: hidden; border-radius: 20px; aspect-ratio: 16 / 10; }
.ba img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ba__after { clip-path: inset(0 0 0 var(--pos)); }
.ba__handle { position: absolute; top: 0; bottom: 0; left: var(--pos); width: 2px; translate: -50%; background: #fff; pointer-events: none; }
.ba__handle::after {
  content: ""; position: absolute; top: 50%; left: 50%; width: 44px; height: 44px; translate: -50% -50%;
  border-radius: 50%; background: #fff; box-shadow: 0 4px 20px rgb(0 0 0 / 0.25);
}
.ba:has(input:focus-visible) .ba__handle::after { outline: 3px solid var(--accent); outline-offset: 3px; }
.ba input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; touch-action: pan-y; }
.ba__tag { position: absolute; top: 12px; padding: 4px 10px; border-radius: 999px; font-size: 12px; background: rgb(0 0 0 / 0.55); color: #fff; }
.ba__tag--l { left: 12px; } .ba__tag--r { right: 12px; }
```

```js
document.querySelectorAll('.ba').forEach((ba) => {
  const input = ba.querySelector('input');
  const set = (v) => ba.style.setProperty('--pos', `${v}%`);
  input.addEventListener('input', () => set(input.value));
  if (reduceMotion) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    const t0 = performance.now();
    const hint = (now) => {
      const p = Math.min((now - t0) / 1200, 1);
      set(50 - 12 * Math.sin(p * Math.PI)); // 50 → 38 → 50
      if (p < 1) requestAnimationFrame(hint);
    };
    requestAnimationFrame(hint);
  }, { threshold: 0.6 }).observe(ba);
});
```

---

## 11. Rolling price (pricing toggle)

**Job:** anchoring + reward. Switching to yearly makes digits roll down like an odometer and a "Save 20%" badge pops — the saving *feels* earned.
**Use:** pricing pages with monthly/yearly. Mark the recommended (middle) plan.

**Spec:** digits roll 700ms ease-out, 50ms stagger right-to-left feel; badge scales 0.8 → 1 with slight overshoot.

```html
<button class="billing-toggle" role="switch" aria-checked="false">Bill yearly <span class="badge">Save 20%</span></button>

<p class="price">
  <span aria-hidden="true">$</span><span class="odo" aria-hidden="true" data-monthly="29" data-yearly="23"></span><span aria-hidden="true">/mo</span>
  <span class="sr-only" data-price-sr></span>
</p>
```

```css
.odo { display: inline-flex; overflow: hidden; height: 1em; line-height: 1; font-variant-numeric: tabular-nums; }
.odo__col {
  display: flex; flex-direction: column;
  transform: translateY(calc(var(--d, 0) * -1em));
  transition: transform 0.7s var(--ease-out); transition-delay: calc(var(--i, 0) * 50ms);
}
.odo__col > span { height: 1em; }
.billing-toggle .badge { display: inline-block; transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); transform: scale(0.9); }
.billing-toggle[aria-checked="true"] .badge { transform: scale(1); }
```

```js
// shortcut: assumes whole-number prices with the same digit count monthly vs yearly;
// if counts differ the columns rebuild without rolling — pad or split decimals into a second .odo.
function renderOdo(el, value) {
  const digits = String(value);
  if (!/^\d+$/.test(digits)) throw new Error(`renderOdo expects digits, got "${value}"`);
  if (el.children.length !== digits.length) {
    el.replaceChildren(...[...digits].map((_, i) => {
      const col = document.createElement('span');
      col.className = 'odo__col';
      col.style.setProperty('--i', i);
      for (let d = 0; d <= 9; d++) col.append(Object.assign(document.createElement('span'), { textContent: d }));
      return col;
    }));
  }
  [...digits].forEach((d, i) => el.children[i].style.setProperty('--d', d));
}

const toggle = document.querySelector('.billing-toggle');
function setYearly(yearly) {
  toggle.setAttribute('aria-checked', String(yearly));
  document.querySelectorAll('.odo').forEach((odo) => {
    const v = yearly ? odo.dataset.yearly : odo.dataset.monthly;
    renderOdo(odo, v);
    odo.closest('.price').querySelector('[data-price-sr]').textContent = `$${v} per month${yearly ? ', billed yearly' : ''}`;
  });
}
toggle.addEventListener('click', () => setYearly(toggle.getAttribute('aria-checked') !== 'true'));
setYearly(false);
```

Pricing psychology: three tiers, highlight the middle, show the yearly saving as both % and amount, put the most expensive plan first on mobile only if it anchors (test it).

---

## 12. Us vs them

**Job:** contrast effect — side by side, the right choice looks obvious.
**Use:** crowded markets, switching campaigns. **Skip:** if claims aren't true or verifiable. Prefer "Typical agencies" / "DIY tools" over naming competitors unless the facts are solid.

**Spec:** "Us" column elevated (accent tint, border, slight scale), checkmarks draw in row by row (80ms stagger).
"Them" column muted gray ✕ — not red; aggression looks insecure.

```html
<table class="vs" data-inview>
  <caption class="sr-only">How we compare with typical agencies</caption>
  <thead><tr><th scope="col">Feature</th><th scope="col" data-us>Us</th><th scope="col">Typical agency</th></tr></thead>
  <tbody>
    <tr style="--row:0">
      <th scope="row">Launch in 14 days</th>
      <td data-us><svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg><span class="sr-only">Yes</span></td>
      <td class="no"><span aria-hidden="true">✕</span><span class="sr-only">No</span></td>
    </tr>
  </tbody>
</table>
```

```css
.vs { width: 100%; border-collapse: separate; border-spacing: 0; }
.vs th, .vs td { padding: 16px; text-align: left; border-bottom: 1px solid var(--border); }
.vs [data-us] { background: color-mix(in oklch, var(--accent) 7%, var(--surface)); font-weight: 600; }
.vs thead [data-us] { border-radius: 16px 16px 0 0; }
.vs .no { color: var(--muted); }
.vs .check { width: 22px; height: 22px; }
.vs .check path {
  fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  transition: stroke-dashoffset 0.4s var(--ease-out) calc(var(--row, 0) * 80ms);
}
.vs.is-in .check path { stroke-dashoffset: 0; }
@media (max-width: 640px) { .vs th, .vs td { padding: 12px 8px; font-size: 14px; } }
```

On narrow screens keep 3 columns (they fit) or turn it into two stacked cards: "With us" list first, "Without us" second.

---

## 13. Click to success

**Job:** peak-end rule — the last moment of an action defines how it's remembered. The button itself
becomes the confirmation: label → spinner → drawn checkmark.
**Use:** primary forms (sign-up, contact, checkout, newsletter). **Skip:** navigation links.

**Spec:** press scale 0.97 (120ms). Loading shown for at least 600ms (no flicker). Success: background
to `--success`, checkmark draws in 450ms, hold 2.4s. Error: shake 300ms + message. Width never changes.

```html
<button class="cta" data-state="idle" type="submit">
  <span class="cta__label">Get my free audit</span>
  <span class="cta__spin" aria-hidden="true"></span>
  <svg class="cta__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>
</button>
<p class="sr-only" role="status" data-cta-status></p>
```

```css
.cta {
  display: inline-grid; place-items: center; padding: 14px 24px; border: 0; border-radius: 12px;
  background: var(--accent); color: var(--bg); font-weight: 600; cursor: pointer;
  transition: background-color 0.3s, transform 0.12s var(--ease-out);
}
.cta > * { grid-area: 1 / 1; transition: opacity 0.2s, transform 0.3s var(--ease-out); } /* stacked: width = widest child */
.cta:active { transform: scale(0.97); }
.cta__spin { width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; opacity: 0; }
.cta__check { width: 22px; height: 22px; opacity: 0; }
.cta__check path { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 0.45s var(--ease-out) 0.1s; }
.cta:not([data-state="idle"], [data-state="error"]) .cta__label { opacity: 0; transform: translateY(-6px); }
.cta[data-state="loading"] .cta__spin { opacity: 1; animation: spin 0.7s linear infinite; }
.cta[data-state="success"] { background: var(--success); }
.cta[data-state="success"] .cta__check { opacity: 1; }
.cta[data-state="success"] .cta__check path { stroke-dashoffset: 0; }
.cta[data-state="error"] { background: var(--danger); }
@keyframes spin { to { rotate: 360deg; } }
```

```js
async function runCta(btn, action) {
  if (btn.dataset.state !== 'idle') return; // blocks double submits without disabling (keeps focus)
  const status = document.querySelector('[data-cta-status]');
  btn.dataset.state = 'loading';
  btn.setAttribute('aria-busy', 'true');
  try {
    await Promise.all([action(), new Promise((r) => setTimeout(r, 600))]);
    btn.dataset.state = 'success';
    status.textContent = 'Sent. Check your inbox in the next 2 minutes.';
    setTimeout(() => (btn.dataset.state = 'idle'), 2400);
  } catch {
    btn.dataset.state = 'error';
    status.textContent = 'Something went wrong. Please try again.';
    btn.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 300 });
    setTimeout(() => (btn.dataset.state = 'idle'), 1500);
  } finally {
    btn.removeAttribute('aria-busy');
  }
}

document.querySelector('form.signup')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  runCta(form.querySelector('.cta'), () =>
    fetch(form.action, { method: 'POST', body: new FormData(form) }).then((r) => { if (!r.ok) throw new Error(r.status); }));
});
```

Optional for milestone moments only (purchase, account created): a small confetti burst (`canvas-confetti`, 60 particles, brand colors). Never on routine clicks.

---

## 14. Micro-interactions (the "precision" layer)

Small, fast, everywhere. These are what make a site feel expensive when nobody can say why.

| Element | Interaction | Spec |
|---|---|---|
| Buttons | hover lift + shadow, press scale | `translateY(-1px)`, 120ms; `:active` scale 0.97 |
| Links | underline grows from left | `background-size` 0 → 100% on `linear-gradient` underline, 240ms |
| Cards | lift + border brightens | `translateY(-2px)`, border alpha +10%, 240ms |
| Images in cards | slow zoom | `scale(1.03)`, 600ms ease-out, inside `overflow:hidden` |
| Nav | hide on scroll down, show on scroll up; blur background after 8px scroll | 240ms |
| Logo strip | infinite marquee, edges fade, pauses on hover and with global pause | `mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)` |
| Primary CTA (desktop) | magnetic pull toward cursor | max 6px, spring back 300ms |
| Focus | visible custom ring | `outline: 2px solid var(--accent); outline-offset: 3px` — never remove focus |
| Inputs | label floats, border to accent, success check on valid | 200ms |
| Scroll | thin progress bar at top on long articles | `animation-timeline: scroll()` with no-JS fallback = hidden |

Magnetic button:

```js
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.style.transition = 'transform 0.3s var(--ease-out)';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 12;  // max ±6px
      const y = ((e.clientY - r.top) / r.height - 0.5) * 12;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}
```

Hide-on-scroll nav:

```js
let lastY = scrollY;
addEventListener('scroll', () => {
  const nav = document.querySelector('.site-nav');
  nav.classList.toggle('is-hidden', scrollY > lastY && scrollY > 120);
  nav.classList.toggle('is-scrolled', scrollY > 8);
  lastY = scrollY;
}, { passive: true });
```

```css
.site-nav { position: sticky; top: 0; transition: transform 0.24s var(--ease-out), background-color 0.24s; }
.site-nav.is-hidden { transform: translateY(-100%); }
.site-nav.is-scrolled { background: color-mix(in oklch, var(--bg) 80%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.site-nav:focus-within { transform: none; } /* keyboard users never lose the nav */
```

---

## Porting notes

**React + Motion (`motion` package)**

- Reveal → `<motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -10% 0px' }} transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }} />`
- Stagger groups → parent `variants` with `staggerChildren: 0.06`.
- Reduced motion → wrap the app in `<MotionConfig reducedMotion="user">`; use `useReducedMotion()` for custom loops.
- Rotator, pings, review deck → `AnimatePresence` (`mode="popLayout"`) with keyed children; deck reorder → `layout` prop.
- Count-up → `useInView` + `animate(0, end, { onUpdate })`.
- Hero split text → split words in JSX at render (no DOM mutation, no hydration mismatch).
- All DOM-touching vanilla code goes in `useEffect` with cleanup (`observer.disconnect()`, `clearInterval`).
- Next.js App Router: animated components need `'use client'`; keep page shells as server components.

**GSAP**

- Reveal → `gsap.from(el, { y: 16, opacity: 0, duration: 0.48, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 90%', once: true } })`.
- Process draw → `scrub: true` on a ScrollTrigger tween of `strokeDashoffset`.
- Reduced motion → `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)`.
- React → `@gsap/react` `useGSAP()` for automatic cleanup.

**Vue / Nuxt:** `<Transition>` / `<TransitionGroup>` for rotator, pings and deck; run observers in `onMounted`, clean up in `onUnmounted`.

**Svelte / SvelteKit:** built-in `transition:fly` / `animate:flip`; use `{#key}` for the rotator; `prefersReducedMotion` from `svelte/motion`.

**Tailwind:** put motion tokens in `@theme` (`--ease-out`, `--animate-*`) and use `motion-safe:` / `motion-reduce:` variants.

**WordPress / plain HTML:** use the vanilla code as is, enqueue one small `motion.js` with `defer`.
