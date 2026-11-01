# Demo Shop — Design Brief (premium-ui-expert-v1)

**Assumptions (non-interactive run, none confirmed by the user):** Confident motion; light theme with automatic dark mode; no reference site; no real reviews, stats or purchase feed exist, so those modules are skipped.

- **Brand:** Fieldnote Goods — a small shop of useful things. Feel: calm, precise, warm.
- **Emotion:** quiet confidence. **Peak moment:** the hero reveal. **Second moment:** the Pay button turning into a drawn check mark.
- **Colour:** "Editorial Ivory" palette from the skill. One accent (terracotta). Dark mode is its own set of values, not inverted. All text/background pairs are checked by `test/contrast.test.mjs`.
- **Type:** system fonts only (the server's CSP allows no external fonts). Display: `ui-serif` stack, tight tracking, `text-wrap: balance`. Body: `system-ui`. Fluid headline with `clamp()`.
- **Space and shape:** 4/8 spacing, 16px page gutter, one radius family (8 / 14 / 24), hairline 1px borders, one soft shadow.
- **Motion tokens:** ease-out `cubic-bezier(.22,1,.36,1)`; durations 120 / 240 / 480 / 800 ms; stagger 60 ms. Only `transform` and `opacity`. Reduced motion shows final states.
- **Constraint from the backend:** CSP is `script-src 'self'; style-src 'self'`, so there are no inline scripts and no inline `style=""` attributes. All styling is in `styles.css`; JS sets only CSS variables through the CSSOM.

| Section | Job | Module |
|---|---|---|
| Hero | first impression, one clear action | 2 Hero reveal |
| Product grid | browse and add | 0 Reveal, 14 Micro-interactions (hover lift, art zoom, press) |
| Cart drawer | review, change quantity | 14 (count badge bump, focus handling) |
| Checkout | confidence at the moment of payment | 13 Click to success |
| Orders | calm, scannable history | 0 Reveal |

**Skipped on purpose:** 4 activity pings and 5 review shuffle (no real data), 6 count-up stats (no real stats), 1 preloader (a shop should feel fast).

**Honest-content rules applied:** the "limited print" is really a single item in the database; there are no fake counters, timers or reviews; the page says payments are simulated.
