# Feature, Flow & UI Testing (E2E + Devtools)

## 1. Setup (only if the project has no E2E tool)

```bash
npm init playwright@latest
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

Log in once per role and reuse the session:

```ts
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

for (const role of ['customer', 'staff', 'admin']) {
  setup(`login as ${role}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env[`E2E_${role.toUpperCase()}_EMAIL`]!);
    await page.getByLabel('Password').fill(process.env[`E2E_${role.toUpperCase()}_PASSWORD`]!);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/dashboard**');
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
```

Test accounts come from the project's seed script or `.env.test` — never real users' credentials. Add `e2e/.auth/` to `.gitignore`.

## 2. Make every test a devtools check

Use this fixture instead of the default `test` so **any** console error, uncaught exception, failed request or `5xx`
fails the test — the same things you would spot in the Console and Network panels.

```ts
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    const seen = new Map<string, number>();
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`failed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    page.on('request', (r) => {
      if (!r.url().includes('/api/')) return;
      const key = `${r.method()} ${r.url()}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    await use(page);
    const dupes = [...seen].filter(([key, n]) => n > 1 && key.startsWith('GET')).map(([key, n]) => `duplicate x${n}: ${key}`);
    expect([...problems, ...dupes], [...problems, ...dupes].join('\n')).toEqual([]);
  },
});
export { expect };
```

Duplicate-GET detection may flag legitimate refetches (e.g. after a mutation) — then check whether the second call is
really needed; if it is, exclude that URL explicitly with a comment.

## 3. Feature coverage — per feature, per role

For every feature, test these states — most "it works on my machine" bugs live in the non-happy ones:

| State | Check |
|---|---|
| Happy path | Create, read, update, delete work and persist after reload |
| Validation | Each rule shows a clear message; server rejects the same bad data |
| Empty state | No data yet → helpful empty state, not a blank area or error |
| Loading state | Skeleton/spinner, no layout jump, no double submit |
| Error state | API fails → readable message + retry; no infinite spinner |
| Permissions | Each role sees/does only what it should (UI **and** API) |
| Lists | Pagination, sorting, filters, search; filters survive back/refresh if expected |
| Persistence | Reload, new tab, log out/in, other device → data correct |
| Notifications | Emails/notifications sent once, with correct content and links (use a test inbox like Mailpit/MailHog) |

## 4. Feature interaction matrix

Bugs live where features meet. List the features, then for each pair that shares data, write what must stay true.
Example for e-commerce:

| When this happens… | …check this | Must stay true |
|---|---|---|
| Order placed | Inventory | Stock decremented exactly once |
| Order cancelled / refunded | Inventory, payment, coupon | Stock restored; refund ≤ paid; single-use coupon policy applied (restored or not, by rule) |
| Coupon applied | Cart, tax, shipping, invoice, reports | Discount before/after tax as specified; invoice and reports match the charge |
| Product price changed | Open carts, existing orders | Carts show new price before payment; past orders keep their price |
| Product deleted / hidden | Carts, wishlists, order history, search | Can't be bought; history still renders |
| User role changed | Active sessions, admin pages, API | Takes effect on the next request |
| Account deleted | Orders, reviews, subscriptions, emails | Defined behavior; no orphaned charges; personal data removed per policy |
| Subscription cancelled | Access, billing, emails | Access until period end (if promised); no further charges |
| Currency / language switched | Prices, emails, invoices | Consistent everywhere, including emails and PDFs |
| Stock edited by admin during checkout | Checkout | Uses current stock; no oversell |

Write one E2E or integration test per row that touches money, stock, access or personal data.

## 5. Exploratory testing with devtools

When a browser/devtools tool is available (Chrome DevTools MCP, Playwright MCP, the agent's built-in browser, or a
headed Playwright session with `npx playwright test --ui`), walk each critical flow by hand and watch:

| Panel / tool | Look for |
|---|---|
| **Console** | Errors, warnings, React key/hydration warnings, leaked data in logs |
| **Network** | Failed and `4xx/5xx` calls, duplicates, waterfalls, payload sizes, slow calls (> 500 ms), uncached static assets, `http://` calls |
| **Application** | Cookies (`HttpOnly`, `Secure`, `SameSite`), tokens or personal data in local/session storage, service worker caching private data |
| **Performance** | Long tasks > 50 ms, layout shifts, slow interactions (INP), memory growing while idle |
| **Lighthouse** | Performance, accessibility, best practices, SEO scores on key pages (mobile) |
| **Throttling** | "Slow 4G" + 4× CPU slowdown — the real experience for many users |
| **Rendering** | `prefers-reduced-motion`, dark mode, print styles if relevant |

Record what you saw (screenshots, HAR, traces) as evidence for each finding.

## 6. Accessibility

```bash
npm i -D @axe-core/playwright
```

```ts
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('checkout has no serious accessibility violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
```

Plus manual: full keyboard path through each critical flow (visible focus, logical order, no traps), screen reader
spot-check of forms and errors, 200% zoom.

## 7. Responsive and cross-browser

- Run the suite on desktop Chrome, WebKit (Safari engine) and a mobile device profile (config above).
- Check key pages at 320, 375, 768, 1024, 1440 px for horizontal scroll:

```ts
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`home has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

- Visual regression for stable pages: `await expect(page).toHaveScreenshot()` (update baselines only after a human approves the change).

## 8. Fixing UI bugs

1. Reproduce in the browser at the failing width/browser; capture a screenshot or trace.
2. Inspect the element: computed styles, box model, which rule wins, which component renders it.
3. Find the source component and the real cause (overflow from a fixed width, missing `min-width: 0` in flex, z-index stacking, hydration mismatch, race in state updates…).
4. Fix in the component/token that owns the style — not with a one-off override or `!important`.
5. Re-check at all widths and browsers, run the related E2E tests, and add a test (or screenshot) that would have caught it.
6. If `premium-ui-expert-v1` is installed, follow its motion, contrast and responsiveness rules for the fix.
