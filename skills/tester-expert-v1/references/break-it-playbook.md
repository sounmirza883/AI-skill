# Break-It Playbook

How real users, bad networks and attackers break systems — and how to prove it with a test. For each flow in the
Test Plan, pick the scenarios that apply. Every scenario has: **what to do**, **what must happen**, and where useful
**test code** and the **correct fix pattern** (so you can recognize a wrong fix).

Code uses Playwright (`@playwright/test`) with `baseURL` set in `playwright.config`. Replace selectors and helper
functions (`fillTestCard`, `setStock`, `seedUser`) with the project's own. Never use real cards — use the payment
provider's published test cards in sandbox mode.

---

## 1. Double and rapid actions

| Scenario | Must happen |
|---|---|
| Double-click / triple-click "Pay", "Place order", "Submit" | Exactly one order, one charge, one email |
| Press Enter twice in a form | One submission |
| Click "Add to cart" 5 times fast | Quantity matches the clicks *or* the UI blocks extra clicks — never a broken cart |
| Click "Like", "Follow", "Vote" rapidly | Final state consistent; counts never double-count |
| Click "Delete" twice | Second click is a no-op or 404 — never an error page or deleting the next item |
| Click "Send code" (OTP) repeatedly | Rate limited; old codes invalidated or still valid by design |
| Mobile: tap during a page transition | No action applied to the wrong item |

**Test: double payment through the UI** — four synchronous clicks fire before the page can re-render or disable the
button, which is exactly what a fast user or a bouncing mouse does.

```ts
import { test, expect } from '@playwright/test';

test('rapid clicks on Pay create exactly one order', async ({ page }) => {
  const startedAt = new Date().toISOString();
  const checkoutPosts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/checkout')) checkoutPosts.push(r.headers()['idempotency-key'] ?? 'none');
  });

  await page.goto('/products/test-mug');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/checkout');
  await fillTestCard(page); // sandbox test card

  await page.getByRole('button', { name: /pay/i }).evaluate((btn: HTMLButtonElement) => {
    for (let i = 0; i < 4; i++) btn.click();
  });
  await expect(page.getByText(/order confirmed/i)).toBeVisible({ timeout: 20_000 });

  // The server is the source of truth: count orders, not clicks.
  const orders = await (await page.request.get(`/api/orders?since=${startedAt}`)).json();
  expect(orders.items).toHaveLength(1);
  // If several requests were sent, they must share one idempotency key.
  expect(new Set(checkoutPosts).size).toBeLessThanOrEqual(1);
});
```

Also check the payment provider's sandbox dashboard or API: one successful charge for the order.

**Test: double payment through the API** (bypasses any UI protection):

```bash
AUTH="Cookie: session=<test buyer session>" node scripts/race.mjs https://staging.example.com/api/checkout 5 '{"cartId":"c_123"}' 3f1c-same-key
```

```bash
AUTH="Cookie: session=<test buyer session>" node scripts/race.mjs https://staging.example.com/api/checkout 5 '{"cartId":"c_124"}'
```

Expected: with the same key → one `2xx` and the rest either the same stored response or `409`. Without a key → one
`2xx`, the rest `409 checkout already in progress / cart already ordered`. More than one `2xx` that created an order = **S1 bug**.

**Correct fix pattern (all layers, not just one):**

1. UI: disable the button on first click and show progress (UX only — not protection).
2. Client: generate an idempotency key per checkout attempt (`crypto.randomUUID()`), reuse it on retries.
3. Server: store `(user_id, idempotency_key)` with a unique constraint; return the stored response on repeats.
4. Server: move the cart/order through states with a conditional update
   (`UPDATE carts SET status = 'checking_out' WHERE id = $1 AND status = 'open'` → 0 rows → `409`).
5. Payment provider: pass the same idempotency key (most providers support one, e.g. Stripe's `Idempotency-Key` header).
6. Webhooks: dedupe by event ID; mark paid with `WHERE status = 'pending'`.

---

## 2. Races between users and devices

| Scenario | Must happen |
|---|---|
| Two buyers, one unit left, buy at the same time | Exactly one succeeds; the other gets a clear "sold out"; stock ends at 0, never −1 |
| Single-use coupon redeemed in two tabs/devices at once | Applied once |
| Two admins edit the same product | Second save gets a conflict (or last-write-wins *by design*, never silent field loss) |
| Wallet/credit spent twice concurrently | Balance never negative |
| Booking the last seat/slot | One booking |
| Same user, two devices, checkout same cart | One order |

```ts
import { test, expect } from '@playwright/test';

test('one unit left, two buyers at once: exactly one order', async ({ browser }) => {
  await setStock('test-mug', 1);
  const buyerA = await browser.newContext({ storageState: 'auth/buyer-a.json' });
  const buyerB = await browser.newContext({ storageState: 'auth/buyer-b.json' });
  await Promise.all([addToCart(buyerA, 'test-mug'), addToCart(buyerB, 'test-mug')]);

  const [a, b] = await Promise.all([
    buyerA.request.post('/api/checkout', { data: { paymentMethod: 'pm_card_visa' } }),
    buyerB.request.post('/api/checkout', { data: { paymentMethod: 'pm_card_visa' } }),
  ]);
  expect([a.status(), b.status()].sort()).toEqual([200, 409]);
  expect(await getStock('test-mug')).toBe(0);
});
```

Repeat races 20–50 times in a loop — race bugs don't show up on every run.

---

## 3. Tabs, sessions and roles

| Scenario | Must happen |
|---|---|
| Log out in tab A, click "Save" in tab B | Redirect to login / "session expired" — never a silent save or a crash |
| Cart changed in tab A, checkout in tab B | Checkout uses the current server cart and shows the change |
| Admin removes a user's role while they are logged in | Next request is denied (permissions checked per request, not cached in the session forever) |
| Password changed on device A | Other sessions revoked (if the product promises it) |
| Session expires during a long form | Draft not lost; user re-authenticates and can submit |
| Open the same edit form in two tabs | Conflict detection or clearly defined last-write-wins |

```ts
test('logout in one tab blocks actions in another', async ({ context }) => {
  const tab1 = await context.newPage();
  const tab2 = await context.newPage();
  await tab1.goto('/account');
  await tab2.goto('/account/profile');
  await tab1.getByRole('button', { name: /log out/i }).click();
  await tab2.getByLabel('Name').fill('Changed after logout');
  await tab2.getByRole('button', { name: /save/i }).click();
  await expect(tab2.getByText(/log in|session expired/i)).toBeVisible();
});
```

---

## 4. Navigation: back, refresh, deep links, skipped steps

| Scenario | Must happen |
|---|---|
| Press Back after a successful payment, then Pay again | No second charge; shows "already paid" |
| Refresh on the "processing payment" page | Status is recovered from the server; no re-submit |
| Browser "resubmit form?" dialog after POST | Server-side dedupe makes it harmless (use POST → redirect → GET) |
| Open `/checkout/success?order=<someone else's id>` | `404`/`403` — never another customer's order |
| Jump to step 3 of a wizard without steps 1–2 | Redirect to the first incomplete step; server rejects incomplete data |
| Open an old bookmarked step after the flow finished | Sensible redirect, no crash |
| Open a page directly while logged out | Login, then return to the page |

```ts
test('back + pay again after success does not charge twice', async ({ page }) => {
  const startedAt = new Date().toISOString();
  await completeCheckout(page);
  await page.goBack();
  const pay = page.getByRole('button', { name: /pay/i });
  if (await pay.isVisible()) await pay.click();
  const orders = await (await page.request.get(`/api/orders?since=${startedAt}`)).json();
  expect(orders.items).toHaveLength(1);
});
```

---

## 5. Network problems

| Scenario | How | Must happen |
|---|---|---|
| Very slow API (user clicks again, refreshes) | `page.route` with a delay | Progress shown; no duplicates |
| Offline during submit | `context.setOffline(true)` | Clear error, form data kept, retry works once |
| API returns 500 | `route.fulfill({ status: 500 })` | Helpful message, no blank page, no infinite spinner |
| API returns malformed JSON / unexpected shape | `route.fulfill({ body: '<html>' })` | Graceful error, no crash |
| Request succeeded but the response was lost (timeout) | Delay the response past the client timeout, then retry | Retry with the same idempotency key → no duplicate |
| Third party down (payment, maps, email) | Block the third-party host | Core app still works; clear message for that feature |

```ts
test('slow checkout: impatient user does not create duplicates', async ({ page }) => {
  await page.route('**/api/checkout', async (route) => {
    await new Promise((r) => setTimeout(r, 8_000));
    await route.continue();
  });
  const startedAt = new Date().toISOString();
  await goToCheckoutWithItem(page);
  const pay = page.getByRole('button', { name: /pay/i });
  await pay.click();
  await pay.click({ force: true });   // impatient second click while waiting
  await expect(page.getByText(/order confirmed/i)).toBeVisible({ timeout: 30_000 });
  const orders = await (await page.request.get(`/api/orders?since=${startedAt}`)).json();
  expect(orders.items).toHaveLength(1);
});

test('server error shows a helpful message', async ({ page }) => {
  await page.route('**/api/orders**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' }));
  await page.goto('/account/orders');
  await expect(page.getByText(/something went wrong|try again/i)).toBeVisible();
});
```

---

## 6. Tampering (the client is not trusted)

Use devtools or direct API calls to send what the UI would never send. The server must reject or ignore it.

| Tamper | Must happen |
|---|---|
| Change price / total / discount in the request body | Server recomputes from its own data |
| Quantity `0`, `-1`, `1.5`, `999999`, `"1e9"`, `null` | `422` validation error; stock untouched |
| Add `"role":"admin"`, `"isVerified":true`, `"userId":<other>` to a profile update | Ignored or rejected (mass assignment) |
| Re-enable a disabled button / remove `required` in devtools and submit | Server validation still rejects |
| Change the product/order/user ID in the URL or body | Ownership check → `404`/`403` |
| Change currency, shipping method or tax region to a cheaper one after quoting | Server recalculates, or rejects the mismatch |
| Replay a captured request later | Idempotent, or rejected as stale/duplicate |

```ts
test('server ignores a client-sent price', async ({ page }) => {
  await page.request.post('/api/cart/items', { data: { productId: 'test-mug', quantity: 1, price: 0.01 } });
  const cart = await (await page.request.get('/api/cart')).json();
  expect(cart.items[0].unitPrice).toBe(TEST_MUG_PRICE);
});
```

---

## 7. Input boundaries

Try each field with these. Expect a clear validation message (client) **and** a `422`/`400` (server) — never a `500`.

| Input | Examples |
|---|---|
| Empty / whitespace | `""`, `"   "`, missing field, `null` |
| Length | 1 char, max length, max + 1, 10,000 chars, 1 MB body |
| Numbers | `0`, `-1`, `0.001`, `1e309`, `NaN`, `9007199254740993`, `"12abc"` |
| Unicode | `Zoë`, `محمد`, `日本語`, emoji `👍🏽`, right-to-left text, zero-width characters |
| Injection probes | `' OR 1=1--`, `{"$ne": null}`, `<script>alert(1)</script>`, `{{7*7}}`, `../../etc/passwd` |
| Email / phone | `a@b`, `a+tag@example.com`, uppercase duplicates (`A@x.com` vs `a@x.com`), international phone formats |
| Dates | `2024-02-30`, `1900-01-01`, far future, different timezone, DST change day |
| Files | Empty file, huge file, wrong extension, renamed `.exe` → `.jpg`, SVG with script, 10,000×10,000 px image |

Rendered output must be escaped (the `<script>` probe shows as text, never runs).

---

## 8. Time and lifecycle

| Scenario | Must happen |
|---|---|
| Coupon/sale expires at midnight — order placed at 23:59:59 / 00:00:01 | Consistent rule, server time, user's timezone shown clearly |
| Price changes after item added to cart | Checkout shows the new price before charging |
| Item goes out of stock while in cart | Clear message at checkout, no charge |
| Cancel an order after it shipped | Blocked or routed to a return flow |
| Refund twice / refund more than paid | Second refund rejected; total refunds ≤ amount paid |
| Edit an order after payment | Blocked or re-priced with explicit confirmation |
| Delete an account with open orders / active subscription | Defined behavior; no orphaned charges |
| Password-reset or email-verification link: reused, expired, opened by another logged-in user | Single use, expires, bound to the right account |
| Leave a page open for hours, then act | Session handled; stale data refreshed before a write |

---

## 9. One user exhausting resources

| Scenario | Must happen |
|---|---|
| `?limit=100000` on a list API | Capped (e.g. 100) |
| 1,000 items in a cart, 500 rows in a bulk import | Limit enforced with a clear message |
| Very long search string, wildcard-only search | Fast rejection or capped query |
| Open 50 tabs / reconnect a WebSocket in a loop | Connection limits; server stays healthy |
| Request expensive exports repeatedly | Rate limited; jobs queued, not run in parallel per user |

---

## 10. Recording a break

For each break you find, capture before fixing: exact steps, expected vs actual, environment, account/role, timestamps,
request/response (from the network panel or test output), and a screenshot or trace (`npx playwright show-trace`).
Then follow the fix loop in `SKILL.md`.
