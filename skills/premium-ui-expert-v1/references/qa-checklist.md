# QA Checklist & Final Report

Run all sections before saying the work is done. Fix failures; list anything you could not check.

## 1. Responsiveness sweep

Check every page at **320, 375, 414, 768, 1024, 1280, 1440, 1920** wide, plus a phone in landscape (844×390).

Find elements that cause horizontal scroll (run in the console at each width):

```js
[...document.querySelectorAll('body *')]
  .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
  .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') || ''}`)
  .slice(0, 20);
```

- [ ] No horizontal scroll at any width.
- [ ] Text never overflows its box; long words and URLs wrap (`overflow-wrap: anywhere` on user content).
- [ ] Headings scale fluidly (`clamp()`), no one-word last lines (`text-wrap: balance`).
- [ ] Tap targets ≥ 44×44px with ≥ 8px between them.
- [ ] Every hover interaction has a touch equivalent; hover effects wrapped in `@media (hover: hover)`.
- [ ] Mobile nav opens, traps focus, closes on Escape and on link click.
- [ ] Full-height sections use `svh`/`dvh`, not `100vh` (iOS address bar).
- [ ] Images: `width`/`height` or `aspect-ratio` set (no layout shift), `srcset`/`sizes`, below-the-fold `loading="lazy"`, hero `fetchpriority="high"`.
- [ ] Tables and wide content scroll inside their own container, not the page.

## 2. Motion QA

- [ ] Page looks complete and correct with all motion disabled.
- [ ] DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: no movement, final states shown (lines drawn, numbers final).
- [ ] Only `transform`, `opacity`, `clip-path` (and rare `filter`) are animated. No layout properties animated on scroll.
- [ ] Performance panel while scrolling: steady ~60fps, no long tasks > 50ms caused by animation code.
- [ ] `will-change` only on elements while they animate (not sprinkled globally).
- [ ] Scroll reveals fire once, don't replay on scroll-up.
- [ ] Hero text readable within 1s; whole hero sequence ≤ 1.2s.
- [ ] Every loop > 5s (rotator, marquee, review deck, cursor tour) obeys the global pause toggle and stops when the tab is hidden.
- [ ] No animation causes layout shift (reserved space for rotators, counters, toasts).
- [ ] Timing tokens are consistent — no random `0.37s` values.

## 3. Accessibility

- [ ] Contrast of every text/background pair passes (checker below). Focus rings ≥ 3:1.
- [ ] Full keyboard path: Tab through the page, every control reachable and visibly focused, logical order.
- [ ] One `<h1>`, headings in order, landmarks (`header`, `nav`, `main`, `footer`).
- [ ] Images have meaningful `alt` (or `alt=""` if decorative). Animated decorative layers are `aria-hidden`.
- [ ] Custom controls have roles and states (`role="switch"` + `aria-checked`, `aria-pressed`, `aria-expanded`).
- [ ] Form fields have labels, errors are announced (`role="status"` / `aria-live="polite"`), not color-only.
- [ ] Zoom to 200%: nothing breaks or hides.

Contrast checker (works in the browser console and in Node):

```js
const luminance = (hex) => {
  const [r, g, b] = hex.replace('#', '').match(/\w\w/g).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};
// contrast('#6B655C', '#FAF8F4') → 5.44  (needs ≥ 4.5 for body text)
```

## 4. Performance

- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms (Lighthouse mobile or PageSpeed Insights).
- [ ] The LCP element (usually hero headline or image) is not hidden with `opacity: 0` waiting for JS.
- [ ] Animation libraries loaded only where used (dynamic import for heavy ones like GSAP plugins, Lottie, Three.js).
- [ ] Fonts: ≤ 2 families, `font-display: swap`, above-the-fold files preloaded.
- [ ] Images in AVIF/WebP, sized for their slot. Videos muted, `playsinline`, poster image, paused when off-screen.

## 5. Cross-browser

- [ ] Chrome / Edge, Safari (macOS + iOS), Firefox.
- [ ] Firefox has no scroll-driven CSS animations by default — fallbacks work.
- [ ] Safari: `backdrop-filter` performance OK, `100vh` issues avoided, `:has()` fallbacks if used for essential behavior.

## 6. AI-look audit

Answer honestly; any "yes" needs a fix:

- [ ] Could this hero belong to any other company if you swapped the logo?
- [ ] Is there a purple/blue gradient, gradient text everywhere, or glowing blobs with no reason?
- [ ] Are there three identical icon-in-circle feature cards?
- [ ] Is any copy generic ("Unlock", "Elevate", "Seamless", "Revolutionize")?
- [ ] Are there emoji/sparkle icons or mixed icon styles?
- [ ] Is every section centered with the same padding and the same fade-up animation?
- [ ] Are any testimonials, logos, numbers or activity pings not real?
- [ ] Is there no signature detail that someone would remember?

## 7. Final report template

```md
## Done: <one-line outcome>

**Direction:** <emotion> · peak moment: <what> · intensity: <Calm/Confident/Expressive>
**Assumptions made:** <only if the user didn't answer the interview>

**What changed**
- Tokens: <file> — palette <name>, fonts <a + b>, motion tokens
- Sections: <list with animation module used in each>
- Responsiveness fixes: <list>

**Checks**
- Widths 320–1920: <pass / issues fixed>
- Reduced motion: <pass>
- Contrast: lowest pair <a on b = x:1>
- Lighthouse mobile: LCP <x>s · CLS <x> · INP <x>ms  (or: "not measured — <why>")

**Needs real content from you**
- <TODO placeholders: reviews, stats, activity feed, screenshots>

**Not checked / risks**
- <e.g. Safari iOS not tested on a real device>
```
