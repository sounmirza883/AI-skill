# Psychology, Color & Visual System

## Why some sites feel premium

People judge a website's credibility in about 50 milliseconds, mostly from visual design. Use these
principles on purpose. Each one names the rule and how to apply it in UI.

| Principle | What it means | Apply it |
|---|---|---|
| **Processing fluency** | Easy-to-process = trustworthy | Strict grid, consistent spacing, ≤ 6 type sizes, one icon set, aligned edges |
| **Aesthetic-usability effect** | Beautiful UIs are perceived as easier to use | Polish the first screen, forms and buttons most |
| **Restraint signals cost** | Luxury uses space; cheap fills every pixel | Generous whitespace, fewer elements per section, one accent color |
| **Precision signals competence** | Small details show care | Optical alignment, consistent radii, 1px hairlines, tuned letter-spacing, no orphan words in headings (`text-wrap: balance`) |
| **Peak-end rule** | Experiences are remembered by the peak and the end | Invest in the hero (peak) and the confirmation moment (click-to-success, thank-you page) |
| **Von Restorff (isolation)** | The one different thing gets noticed | One primary CTA per view, one highlighted pricing plan, one accent color |
| **Hick's law** | More choices = slower decisions | 5–7 nav items, one main action per section, progressive disclosure |
| **Social proof** | We follow what others do | Real logos, specific numbers, named reviews — placed next to CTAs, not hidden at the bottom |
| **Anchoring** | First number sets the reference | Show the yearly saving, show the original price, order plans deliberately |
| **Goal gradient** | Motivation rises near the finish | Progress bars in onboarding and multi-step forms; "Step 2 of 3" |
| **Doherty threshold** | Response under ~400ms keeps people in flow | Instant feedback on every click: press state, optimistic UI, skeletons |
| **Curiosity gap** | Partial information pulls people forward | Word rotator, "see how it works" cursor tours, before/after |
| **Physicality** | Real objects accelerate and decelerate | Ease-out on entrances, never linear for movement, consistent timing |
| **Trust signals** | Proof of a real business | Real address/contact, policy pages, security badges at checkout, consistent footer |

## Color system

### Rules

1. **Neutral first.** 80–90% of a premium UI is neutral. Build an 11-step neutral scale slightly tinted
   toward the brand hue (OKLCH chroma 0.005–0.02). Pure gray looks unfinished; pure `#000` on `#fff` looks harsh.
2. **One accent.** Used for the primary CTA, links, focus rings and key highlights. Two accents only if the brand demands it.
3. **60 / 30 / 10.** 60% background, 30% surfaces and text, 10% accent.
4. **Semantic colors are separate** — success, warning, danger, info — and never reused as brand colors.
5. **Work in OKLCH.** Equal lightness steps look equal; `color-mix(in oklch, …)` gives clean tints and hovers.
6. **Dark mode is designed, not inverted.** Background around `#0A0A0B`–`#111114`, raise elevated surfaces *lighter* (not with shadows),
   reduce accent chroma slightly, use off-white text (`#EDEDF2`), not pure white.
7. **Never put gray text on a colored background.** Tint the text toward the background's hue instead.

### Contrast targets (check every pair — use the checker in `qa-checklist.md`)

| Content | WCAG 2.x minimum | Premium target |
|---|---|---|
| Body text | 4.5 : 1 | 7 : 1 |
| Large text (≥ 24px, or ≥ 19px bold) | 3 : 1 | 4.5 : 1 |
| UI borders that identify controls, focus rings, icons | 3 : 1 | 3 : 1 |
| Placeholder / disabled text | — (but keep ≥ 3 : 1 for placeholders) | — |

APCA (newer model) targets if the project uses it: body Lc 75+, large Lc 60+, non-text Lc 45+.

### Color psychology (starting points, not laws — culture and context matter)

| Hue | Common association | Typical use |
|---|---|---|
| Blue | Trust, stability, competence | Fintech, SaaS, healthcare, B2B |
| Near-black + white | Luxury, authority, focus | Fashion, premium tech, architecture |
| Gold / champagne | Premium, exclusivity, warmth | Luxury, hospitality, premium tiers |
| Green | Growth, health, money, "go" | Finance, wellness, sustainability |
| Teal | Calm competence, modern health | Health tech, productivity |
| Orange | Energy, friendliness, action | Consumer apps, CTAs on neutral sites |
| Red | Urgency, passion, danger | Food, entertainment; sparingly elsewhere |
| Purple | Creativity, imagination | Creative tools — but heavily overused by AI sites; avoid as default |
| Warm neutrals (cream, sand) | Craft, calm, human | Wellness, interiors, studios, editorial |

### Ready palettes (contrast-checked; adapt hue to the brand)

**Midnight Luxe** — premium SaaS, luxury, dark-first
`--bg #0B0B0F` · `--surface #15151B` · `--border #26262E` · `--text #EDEDF2` · `--muted #9A9AA8` · `--accent #D4AF6A` (champagne; dark text on accent buttons)

**Editorial Ivory** — studios, agencies, hospitality
`--bg #FAF8F4` · `--surface #FFFFFF` · `--border #E7E2D9` · `--text #1A1814` · `--muted #6B655C` · `--accent #B4532A` (terracotta)

**Fintech Trust** — finance, B2B SaaS
`--bg #F7F9FC` · `--surface #FFFFFF` · `--border #E3E8F0` · `--text #0B1B33` · `--muted #51607A` · `--accent #1F5EFF` · `--success #0F7B55`

**Clinical Calm** — health, wellness tech
`--bg #F6FAF9` · `--surface #FFFFFF` · `--border #DDE8E5` · `--text #0E2A2A` · `--muted #4D6664` · `--accent #0B7468`

**Electric Dev** — developer tools, AI infra (dark)
`--bg #09090B` · `--surface #131316` · `--border #24242A` · `--text #FAFAFA` · `--muted #A1A1AA` · `--accent #C6F432` (lime; dark text on accent buttons)

Always re-run the contrast check after changing any hue.

### Token template

```css
:root {
  --bg: #FAF8F4; --surface: #FFFFFF; --border: #E7E2D9;
  --text: #1A1814; --muted: #6B655C; --accent: #B4532A; --on-accent: #FFFFFF;
  --success: #0F7B55; --warning: #A15C00; --danger: #B42318;
  --shadow-1: 0 1px 2px rgb(20 16 10 / 0.06);
  --shadow-2: 0 1px 2px rgb(20 16 10 / 0.04), 0 4px 12px rgb(20 16 10 / 0.06);
  --shadow-3: 0 1px 2px rgb(20 16 10 / 0.04), 0 8px 24px rgb(20 16 10 / 0.08), 0 24px 48px rgb(20 16 10 / 0.06);
  --radius-s: 8px; --radius-m: 14px; --radius-l: 24px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111110; --surface: #1A1917; --border: #2C2A27;
    --text: #EFEBE4; --muted: #A39D93; --accent: #E07A4F; --on-accent: #111110;
  }
}
:root[data-theme="dark"] { /* same values as the media query, for a manual toggle */ }
```

## Typography

- **Pairings that read as premium**
  - Editorial: a display serif (Instrument Serif, Fraunces, Newsreader, PP Editorial*) + a clean grotesk (Inter Tight, Manrope, Geist).
  - Modern tech: one strong grotesk family for everything (Geist, General Sans, Satoshi, Switzer) + a mono accent (Geist Mono, JetBrains Mono).
  - Luxury: high-contrast serif headings, wide-tracked small caps eyebrows, lots of air.
  - *Commercial fonts need a license — check before using; suggest a free alternative if unsure.*
- **Fluid scale** with `clamp()`, ratio ~1.25 (body) to ~1.333 (marketing):
  `--step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem)` … `--step-5: clamp(2.6rem, 1.8rem + 4vw, 5rem)`.
- **Tracking:** large headings `-0.02em` to `-0.04em`; body `0`; uppercase eyebrows `+0.08em` at 12–13px.
- **Body:** 16–18px, line-height 1.5–1.65, measure 60–75 characters (`max-width: 68ch`).
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.
- Load fonts with `font-display: swap`, preload the 1–2 files used above the fold, subset if possible.

## Space, shape, depth

- **Spacing:** 4/8-based scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128). Section padding `clamp(64px, 10vw, 160px)`.
  More space *between* groups than *inside* them (proximity).
- **Grid:** 12 columns desktop, 4 mobile, max content width 1200–1320px. Let one element break the grid on purpose.
- **Radius:** pick one family and keep it (e.g. 8 / 14 / 24). Nested radius = outer radius − padding.
- **Shadows:** layered and soft (see tokens). Light from above. Dark mode → use lighter surfaces and borders instead of shadows.
- **Borders:** 1px with low alpha (`rgb(0 0 0 / 0.08)` light, `rgb(255 255 255 / 0.08)` dark). Hairlines make layouts feel engineered.
- **Texture (optional):** subtle film grain (2–4% opacity SVG noise) on large flat dark areas kills banding and adds richness.
- **Imagery:** real product screenshots in a clean device frame or floating with a soft shadow; consistent photo grading; never mix illustration styles.
