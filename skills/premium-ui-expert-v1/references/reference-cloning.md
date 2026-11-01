# Studying a Reference Site (and adapting it)

Goal: capture **how** a reference feels — layout rhythm, type scale, spacing, color logic and motion
timing — then rebuild that craft with the user's own brand. You are cloning the *system*, not the *assets*.

## Boundaries (read first)

- **Clone:** layout structure, grid, spacing rhythm, type scale ratios, motion timing/easing/stagger, interaction patterns, section order logic.
- **Do not copy:** logos, trademarks, copywriting, photos, illustrations, icons from paid sets, 3D assets, videos, paid fonts, or code lifted from their bundles.
- **Fonts:** if the reference uses a commercial font, name it to the user and propose a licensed or free alternative with similar metrics.
- If the user asks for a pixel-perfect copy of another company's site to pass it off as theirs, explain the trademark/copyright risk and offer the adapted version instead.

## Step 1 — Clarify what to take

Ask (or infer from the user's words): "What do you like about this site — the layout, colors, fonts, animations, or overall feel?"
Then focus the analysis on those parts.

## Step 2 — Open it with a browser tool

Use whatever the agent has, in this order:

1. **Chrome DevTools MCP** (`chrome-devtools-mcp`) — best: screenshots, script evaluation, performance traces, network.
2. **Playwright MCP** or the agent's built-in browser.
3. **Claude in Chrome / browser extension tools.**
4. **No browser tool?** Ask the user for: full-page screenshots (desktop + mobile), a short screen recording of the animations, and the output of the extraction script below pasted from their DevTools console.

Capture:

- Full-page screenshots at **1440×900** and **390×844**.
- Scroll in steps (~600px), screenshot after each step, to catch scroll-triggered states.
- Hover states of buttons, cards, nav items; open menus and modals.
- The first 2 seconds after load (preloader + hero sequence) — screenshot at ~0ms, 300ms, 800ms, 1500ms or record it.

## Step 3 — Extract design tokens (run in the page / DevTools console)

```js
(() => {
  const tally = (map, key) => key && map.set(key, (map.get(key) || 0) + 1);
  const top = (map, n = 12) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  const m = () => new Map();
  const colors = m(), bgs = m(), fonts = m(), type = m(), radii = m(), shadows = m(), transitions = m(), widths = m();

  for (const el of [...document.querySelectorAll('body *')].slice(0, 5000)) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    tally(colors, s.color);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') tally(bgs, s.backgroundColor);
    if (s.backgroundImage.includes('gradient')) tally(bgs, s.backgroundImage.slice(0, 160));
    tally(fonts, s.fontFamily.split(',')[0].trim());
    if (el.childNodes[0]?.nodeType === 3 && el.textContent.trim()) {
      tally(type, `${el.tagName} ${s.fontSize}/${s.lineHeight} w${s.fontWeight} ls:${s.letterSpacing}`);
    }
    if (s.borderRadius !== '0px') tally(radii, s.borderRadius);
    if (s.boxShadow !== 'none') tally(shadows, s.boxShadow);
    if (s.transitionDuration !== '0s') tally(transitions, `${s.transitionProperty} | ${s.transitionDuration} | ${s.transitionTimingFunction}`);
    if (s.maxWidth !== 'none') tally(widths, s.maxWidth);
  }

  const rootVars = {}, keyframes = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.type === CSSRule.KEYFRAMES_RULE) keyframes.push(rule.cssText.slice(0, 400));
        if (rule.selectorText === ':root') {
          for (const p of Array.from(rule.style)) if (p.startsWith('--')) rootVars[p] = rule.style.getPropertyValue(p).trim();
        }
      }
    } catch { /* cross-origin stylesheet: open it in a tab to read it */ }
  }

  const running = document.getAnimations().slice(0, 40).map((a) => ({
    target: a.effect?.target?.getAttribute?.('class')?.slice(0, 60) || a.effect?.target?.tagName,
    name: a.animationName || a.transitionProperty || a.constructor.name,
    timing: a.effect?.getTiming?.(),
  }));

  const libs = {
    gsap: !!window.gsap, ScrollTrigger: !!window.ScrollTrigger,
    lenis: !!window.lenis || document.documentElement.classList.contains('lenis'),
    framer: !!document.querySelector('[data-framer-name], [data-framer-component-type]'),
    webflow: !!window.Webflow, swiper: !!window.Swiper, three: !!window.THREE, lottie: !!window.lottie,
    splitting: !!document.querySelector('[data-splitting], .char, .word'),
  };

  return {
    fonts: top(fonts, 6), typeScale: top(type, 20), textColors: top(colors), backgrounds: top(bgs),
    radii: top(radii, 8), shadows: top(shadows, 8), transitions: top(transitions, 12), maxWidths: top(widths, 6),
    rootVars, keyframes: keyframes.slice(0, 20), runningAnimations: running, libs,
  };
})();
```

In Chrome's console, run `copy(JSON.stringify($_, null, 2))` afterwards to copy the result.

If GSAP is present, dump its tweens (run after scrolling the page once so ScrollTriggers have fired):

```js
window.gsap?.globalTimeline.getChildren(true, true, false).slice(0, 60).map((t) => ({
  targets: (t.targets?.() || []).slice(0, 3).map((el) => el.getAttribute?.('class') || el.id || String(el)),
  duration: t.duration(), delay: t.delay(), ease: String(t.vars.ease ?? 'default'),
  props: Object.keys(t.vars).filter((k) => !['ease', 'duration', 'delay', 'scrollTrigger', 'onComplete'].includes(k)),
  scroll: t.scrollTrigger ? { start: t.scrollTrigger.vars.start, end: t.scrollTrigger.vars.end, scrub: t.scrollTrigger.vars.scrub } : null,
}));
```

## Step 4 — Inspect motion by hand

- **DevTools → More tools → Animations** panel: replay at 10% / 25% speed, read duration, delay and easing curve of each animation group.
- **Performance panel:** record a scroll; see what is animated and whether it is janky (that you should *not* copy).
- **Elements panel:** watch inline `style` attributes change while scrolling (Framer/Motion and GSAP write transforms inline).
- For every animation write: **trigger** (load / in-view / scroll-scrub / hover / click), **properties** (y, opacity, scale, clip-path…), **duration**, **easing**, **stagger**, **distance**.

## Step 5 — Write the Reference Spec

```md
# Reference Spec — <site name> (<url>), studied <date>

## What the user wants from it
<layout / motion / colors / feel>

## Layout
Grid: 12 col, max-width 1280px, gutters 24px. Section padding ~140px desktop / 80px mobile. Hero: split 7/5.

## Type
Display: <font> 72/76 -0.03em · H2 48/52 · Body 18/28 · Eyebrow 13px +0.1em uppercase. Ratio ≈ 1.333.

## Color logic
Near-black bg, one lime accent only on CTAs and active states, muted gray at ~60% for secondary text.

## Shape & depth
Radius 12/20/32. Hairline borders rgba(255,255,255,.08). No shadows on dark; glow on hover only.

## Motion
| Element | Trigger | Props | Duration | Easing | Stagger |
|---|---|---|---|---|---|
| Hero words | load | y 110%→0 (masked) | 900ms | expo.out | 40ms |
| Section cards | in-view once | y 24→0, opacity | 600ms | cubic-bezier(.22,1,.36,1) | 80ms |

## Adapt for <user's brand>
Keep: grid, rhythm, hero sequence, card motion. Change: accent → brand teal, fonts → <licensed alternatives>, all copy and imagery.
```

## Step 6 — Rebuild and compare

Rebuild from the spec using the project's stack and `animations.md`. Then screenshot your build and the
reference at the same widths and compare side by side: spacing rhythm, type sizes, timing feel. Adjust until
the *feel* matches while the *identity* is clearly the user's.

## Inspiration sources

Use these to find patterns and components. Always check the license, re-skin with project tokens, and add
reduced-motion and keyboard support (most showcase components skip them).

| Source | Good for |
|---|---|
| **21st.dev** | Community React + Tailwind components (heroes, pricing, testimonials, animated text); installable via shadcn-style CLI |
| **Aceternity UI** | Flashy hero effects, spotlight cards, animated backgrounds (tone them down) |
| **Magic UI** | Marquees, number tickers, animated beams, bento grids, shimmer buttons |
| **shadcn/ui** | Accessible base components to build on |
| **Motion examples (motion.dev)** | Production-grade React animation patterns |
| **GSAP showcase / CodePen** | Scroll stories, SVG and text animation techniques |
| **Codrops** | Experimental, high-craft effects with tutorials |
| **Awwwards, Godly, Land-book, Lapa Ninja, SaaS Landing Page** | Whole-page layouts and section patterns by industry |
| **Mobbin** | Real app UI flows (onboarding, checkout, settings) |
| **Dribbble** | Visual ideas only — many shots are not buildable or usable |

When the user says "take animations from 21st.dev" (or similar): browse the relevant category, shortlist
2–3 options, show them to the user with one line each on the psychological job, then integrate the chosen one.
