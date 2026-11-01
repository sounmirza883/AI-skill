// Fieldnote Goods storefront. No framework, no build step. Strict CSP: no inline scripts or styles.
const $ = (sel, el = document) => el.querySelector(sel);
const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';

// Builds DOM nodes. Text always goes in through textContent, so server data is never parsed as HTML.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((x) => x != null && x !== false));
  return el;
}

// ---------- product art (simple shapes, no image files) ----------
const ART = {
  mug: ['M30 38h46v44a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12z', 'M76 48h6a10 10 0 0 1 0 20h-6v-6h6a4 4 0 0 0 0-8h-6z'],
  tee: ['M42 26l-24 14 9 16 11-6v42h44V50l11 6 9-16-24-14c-3 8-10 12-18 12s-15-4-18-12z'],
  cap: ['M24 78c0-24 15-40 38-40s38 16 38 40z', 'M60 78h48a4 4 0 0 1 0 8H60z'],
  bottle: ['M52 18h16v12l7 8v52a8 8 0 0 1-8 8H53a8 8 0 0 1-8-8V38l7-8z'],
  notebook: ['M34 20h54v82H34z M28 32h8v6h-8z M28 48h8v6h-8z M28 64h8v6h-8z'],
  poster: ['M32 18h56v84H32z M40 26h40v68H40z'],
  'limited-print': ['M32 18h56v84H32z M40 26h40v68H40z M60 46a14 14 0 1 0 0 28 14 14 0 0 0 0-28z'],
};
function art(id) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'art');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of ART[id] || ART.poster) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill-rule', 'evenodd');
    svg.append(p);
  }
  return svg;
}

// ---------- API ----------
async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { status: res.status, data, retryAfter: res.headers.get('Retry-After') });
  return data;
}
const MESSAGES = {
  invalid_credentials: 'Wrong email or password.',
  not_enough_stock: 'There is not enough stock for that quantity.',
  invalid_quantity: 'Choose a quantity between 1 and 20.',
  cart_empty: 'Your cart is empty.',
  out_of_stock: 'An item in your cart just sold out. Remove it and try again.',
  payment_declined: 'Your card was declined. Try another payment method.',
  checkout_in_progress: 'Your payment is still processing. Please wait a moment.',
};
function describe(e) {
  if (!e.status) return 'Cannot reach the server. Check your connection and try again.';
  if (e.status === 429) return `Too many attempts. Try again in ${e.retryAfter || 'a few'} seconds.`;
  return MESSAGES[e.data?.error] || 'Something went wrong. Please try again.';
}

// ---------- state ----------
const state = { user: null, items: [], cart: { items: [], totalCents: 0 }, pendingAdd: null, checkoutKey: null };
const cartQty = (id) => state.cart.items.find((i) => i.productId === id)?.qty ?? 0;
const cartCount = () => state.cart.items.reduce((s, i) => s + i.qty, 0);

async function load() { // one request renders the whole front: user + products + cart
  const s = await api('/api/screens/shop');
  Object.assign(state, { user: s.user, items: s.items, cart: s.cart });
  renderChrome();
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-in'), 4500);
}
function fail(e) {
  if (e.status === 401) { state.user = null; state.cart = { items: [], totalCents: 0 }; renderChrome(); toast('Please log in to continue.'); location.hash = '#/login'; return; }
  toast(describe(e));
}

// ---------- cart: updates are queued so quick double clicks add up correctly and arrive in order ----------
let queue = Promise.resolve();
let inflight = 0;
const target = new Map();
function setQty(id, qty) {
  target.set(id, qty);
  inflight++;
  state.checkoutKey = null; // cart changed: the next payment is a new attempt
  queue = queue.then(async () => {
    try {
      state.cart = await api(`/api/cart/items/${id}`, { method: 'PUT', body: { quantity: target.get(id) } });
    } catch (e) {
      target.clear();
      try { state.cart = await api('/api/cart'); } catch { /* keep what we have */ }
      fail(e);
    } finally {
      if (--inflight === 0) target.clear();
      renderChrome();
    }
  });
  renderChrome(); // optimistic: show the new count right away
}
function addToCart(id) {
  if (!state.user) { state.pendingAdd = id; toast('Log in to add items to your cart.'); location.hash = '#/login'; return; }
  setQty(id, (target.get(id) ?? cartQty(id)) + 1);
}

// ---------- chrome: nav badge, cart drawer, card labels ----------
function renderChrome() {
  const n = target.size ? [...state.cart.items.map((i) => i.productId), ...target.keys()].filter((v, i, a) => a.indexOf(v) === i).reduce((s, id) => s + (target.get(id) ?? cartQty(id)), 0) : cartCount();
  const badge = $('#cart-count');
  if (badge.textContent !== String(n)) { badge.textContent = n; badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
  $('#cart-btn').setAttribute('aria-label', `Cart, ${n} item${n === 1 ? '' : 's'}`);
  $('#login-link').hidden = !!state.user;
  $('#logout-btn').hidden = !state.user;
  renderDrawer();
  for (const el of document.querySelectorAll('[data-incart]')) {
    const q = target.get(el.dataset.incart) ?? cartQty(el.dataset.incart);
    el.hidden = q === 0;
    el.textContent = `${q} in cart`;
  }
}
function renderDrawer() {
  const body = $('#cart-body');
  const focusKey = document.activeElement?.dataset?.key;
  const items = state.cart.items;
  $('#cart-total').textContent = money(state.cart.totalCents);
  $('#to-checkout').hidden = items.length === 0;
  body.replaceChildren(...(items.length ? items.map((it) => {
    const max = Math.min(20, it.available);
    return h('div', { class: 'ci' },
      h('div', { class: 'ci__top' }, h('strong', { text: it.name }), h('span', { class: 'num', text: money(it.lineCents) })),
      h('div', { class: 'ci__ctl' },
        h('button', { class: 'btn btn--ghost', type: 'button', 'data-key': `dec-${it.productId}`, 'aria-label': `Remove one ${it.name}`, text: '−', onclick: () => setQty(it.productId, it.qty - 1) }),
        h('span', { class: 'ci__qty', 'aria-label': `${it.qty} in cart`, text: String(it.qty) }),
        h('button', { class: 'btn btn--ghost', type: 'button', 'data-key': `inc-${it.productId}`, 'aria-label': `Add one ${it.name}`, disabled: it.qty >= max, text: '+', onclick: () => setQty(it.productId, it.qty + 1) }),
        h('button', { class: 'link-btn', type: 'button', 'data-key': `del-${it.productId}`, 'aria-label': `Remove ${it.name} from cart`, text: 'Remove', onclick: () => setQty(it.productId, 0) })));
  }) : [h('p', { class: 'muted', text: state.user ? 'Your cart is empty.' : 'Log in to start a cart.' })]));
  if (focusKey) $(`[data-key="${focusKey}"]`, body)?.focus();
}

// ---------- hero helpers ----------
function heroEl(tag, props, delay, ...kids) {
  const el = h(tag, { ...props, 'data-hero': '' }, ...kids);
  el.style.setProperty('--d', `${delay}ms`); // CSSOM calls are allowed by the strict CSP
  return el;
}
function splitWords(el) { // masked word rise; aria-label keeps the heading readable as one phrase
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.replaceChildren(...text.split(/\s+/).flatMap((word, i) => {
    const inner = h('span', { text: word });
    inner.style.setProperty('--i', i);
    return [h('span', { class: 'w', 'aria-hidden': 'true' }, inner), ' '];
  }));
}

// ---------- views ----------
function shopView() {
  const tiles = ['mug', 'bottle', 'notebook'].map((id, i) => h('div', { class: `tile tone-${[1, 4, 5][i]}` }, art(id)));
  const hero = h('section', { class: 'hero wrap', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'hero__copy' },
      heroEl('p', { class: 'eyebrow', text: 'Demo shop · payments are simulated' }, 0),
      h('h1', { id: 'hero-title', 'data-split': '', text: 'Seven good things for everyday use' }),
      heroEl('p', { class: 'lede', text: 'A mug, a cap, a notebook that lies flat. Log in with a demo account to try the whole path, from cart to order history.' }, 250),
      heroEl('div', {}, 350, h('button', { class: 'btn btn--primary', type: 'button', text: 'See the products', onclick: () => $('#products').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }) }))),
    heroEl('div', { class: 'hero__visual', 'aria-hidden': 'true' }, 400, ...tiles));

  const cards = state.items.map((p, i) => h('article', { class: 'card', 'data-reveal': '' },
    h('div', { class: `card__art tone-${(i % 6) + 1}` }, art(p.id)),
    h('div', { class: 'card__body' },
      h('h3', { text: p.name }),
      h('p', { class: 'muted', text: p.description }),
      h('div', { class: 'card__row' }, h('span', { class: 'price', text: money(p.priceCents) }), h('span', { class: 'in-cart', 'data-incart': p.id, hidden: true, 'aria-live': 'polite' })),
      h('button', { class: 'btn btn--primary btn--block', type: 'button', disabled: !p.inStock, 'aria-label': p.inStock ? `Add ${p.name} to cart` : `${p.name} is sold out`, text: p.inStock ? 'Add to cart' : 'Sold out', onclick: () => addToCart(p.id) }))));
  const products = h('section', { class: 'wrap section', id: 'products', 'aria-labelledby': 'products-title' }, h('h2', { id: 'products-title', text: 'Products' }), h('div', { class: 'grid' }, ...cards));
  return h('div', {}, hero, products);
}

function loginView() {
  const err = h('p', { class: 'form-error', role: 'alert' });
  const email = h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'username', required: true, maxlength: '254' });
  const password = h('input', { id: 'password', name: 'password', type: 'password', autocomplete: 'current-password', required: true, maxlength: '200' });
  const submit = h('button', { class: 'btn btn--primary btn--block', type: 'submit', text: 'Log in' });
  const form = h('form', { class: 'panel', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'email', text: 'Email' }), email),
    h('div', { class: 'field' }, h('label', { for: 'password', text: 'Password' }), password),
    err, submit,
    h('p', { class: 'muted', text: 'Demo accounts: alice@example.test or bob@example.test. Passwords are in seed.mjs.' }));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (submit.disabled) return;
    err.textContent = '';
    if (!email.value.trim() || !password.value) { err.textContent = 'Enter your email and password.'; return; }
    submit.disabled = true;
    try {
      await api('/api/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } });
      await load();
      const add = state.pendingAdd;
      state.pendingAdd = null;
      location.hash = '#/';
      if (add) addToCart(add);
    } catch (e) {
      err.textContent = describe(e);
      password.value = '';
      password.focus();
    } finally { submit.disabled = false; }
  });
  return h('section', { class: 'page narrow' }, h('h1', { text: 'Log in' }), form);
}

function ordersView() {
  const box = h('div', { class: 'orders', 'aria-busy': 'true' }, h('p', { class: 'muted', text: 'Loading your orders…' }));
  const label = { paid: 'Paid', pending: 'Processing', failed: 'Payment failed' };
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  api('/api/orders').then(({ items }) => {
    box.replaceChildren(...(items.length ? items.map((o) => h('article', { class: 'order', 'data-reveal': '' },
      h('div', { class: 'order__head' },
        h('span', { class: 'order__id', text: o.id }),
        h('span', { class: `chip chip--${o.status}`, text: label[o.status] || o.status }),
        h('time', { datetime: o.createdAt, class: 'muted', text: fmt.format(new Date(o.createdAt)) })),
      h('ul', { class: 'lines' }, o.items.map((i) => h('li', {}, h('span', { text: `${i.qty} × ${i.name}` }), h('span', { class: 'num', text: money(i.unitCents * i.qty) })))),
      h('p', { class: 'total' }, h('span', { text: 'Total' }), h('strong', { text: money(o.totalCents) })))) : [
      h('div', { class: 'empty' }, h('p', { text: 'No orders yet.' }), h('a', { class: 'btn btn--primary', href: '#/', text: 'Start shopping' }))]));
    watchReveals();
  }).catch(fail).finally(() => box.removeAttribute('aria-busy'));
  return h('section', { class: 'page wrap' }, h('h1', { text: 'Your orders' }), box);
}

function confirmationView(order) {
  return h('section', { class: 'page narrow' },
    h('h1', { id: 'confirm-title', tabindex: '-1', text: 'Order confirmed' }),
    h('p', { class: 'muted', text: `Thank you. Your order number is ${order.id}.` }),
    h('div', { class: 'panel' },
      h('ul', { class: 'lines' }, order.items.map((i) => h('li', {}, h('span', { text: `${i.qty} × ${i.name}` }), h('span', { class: 'num', text: money(i.unitCents * i.qty) })))),
      h('p', { class: 'total' }, h('span', { text: 'Paid' }), h('strong', { text: money(order.totalCents) }))),
    h('div', {}, h('a', { class: 'btn btn--primary', href: '#/orders', text: 'View your orders' })));
}

function checkoutView() {
  if (!state.user) { state.pendingAdd = null; location.hash = '#/login'; return h('div'); }
  const items = state.cart.items;
  if (!items.length) return h('section', { class: 'page narrow' }, h('h1', { text: 'Checkout' }), h('div', { class: 'empty' }, h('p', { text: 'Your cart is empty.' }), h('a', { class: 'btn btn--primary', href: '#/', text: 'Back to the shop' })));

  const err = h('p', { class: 'form-error', role: 'alert' });
  const status = h('p', { class: 'sr-only', role: 'status' });
  const btn = h('button', { class: 'cta', type: 'submit', 'data-state': 'idle' },
    h('span', { class: 'cta__label', text: `Pay ${money(state.cart.totalCents)}` }),
    h('span', { class: 'cta__spin', 'aria-hidden': 'true' }));
  const check = document.createElementNS(NS, 'svg');
  check.setAttribute('class', 'cta__check'); check.setAttribute('viewBox', '0 0 24 24'); check.setAttribute('aria-hidden', 'true');
  const tick = document.createElementNS(NS, 'path'); tick.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5'); tick.setAttribute('pathLength', '1');
  check.append(tick); btn.append(check);

  const form = h('form', { class: 'panel', novalidate: true },
    h('fieldset', {}, h('legend', { text: 'Payment (simulated)' }),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'payment', value: 'pm_card_visa', checked: true }), 'Test card that succeeds'),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'payment', value: 'pm_card_declined' }), 'Test card that is declined')),
    err, btn, status);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (btn.dataset.state !== 'idle') return; // blocks double clicks and double Enter; the server blocks them too
    btn.dataset.state = 'loading';
    btn.setAttribute('aria-busy', 'true');
    err.textContent = '';
    state.checkoutKey ??= crypto.randomUUID(); // same key on retry after a network failure => never charged twice
    try {
      const [res] = await Promise.all([
        api('/api/checkout', { method: 'POST', headers: { 'Idempotency-Key': state.checkoutKey }, body: { paymentMethod: form.elements.payment.value } }),
        sleep(600), // keep the loading state visible long enough to read
      ]);
      btn.dataset.state = 'success';
      status.textContent = 'Payment successful.';
      state.checkoutKey = null;
      target.clear();
      state.cart = { items: [], totalCents: 0 };
      renderChrome();
      await sleep(reduceMotion ? 300 : 1300);
      $('#main').replaceChildren(confirmationView(res.order));
      $('#confirm-title').focus();
    } catch (e) {
      err.textContent = describe(e);
      status.textContent = err.textContent;
      if (e.status && e.data?.error !== 'checkout_in_progress') state.checkoutKey = null; // server gave a final answer: next click is a new attempt
      btn.dataset.state = 'error';
      await sleep(1500);
      btn.dataset.state = 'idle';
    } finally { btn.removeAttribute('aria-busy'); }
  });

  return h('section', { class: 'page narrow' }, h('h1', { text: 'Checkout' }),
    h('div', { class: 'panel' },
      h('ul', { class: 'lines' }, items.map((i) => h('li', {}, h('span', { text: `${i.qty} × ${i.name}` }), h('span', { class: 'num', text: money(i.lineCents) })))),
      h('p', { class: 'total' }, h('span', { text: 'Total' }), h('strong', { text: money(state.cart.totalCents) }))),
    form);
}

// ---------- router ----------
const ROUTES = { '/': ['Fieldnote Goods', shopView], '/login': ['Log in – Fieldnote Goods', loginView], '/orders': ['Your orders – Fieldnote Goods', ordersView], '/checkout': ['Checkout – Fieldnote Goods', checkoutView] };
const revealObserver = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealObserver.unobserve(e.target); } // reveal once
}, { rootMargin: '0px 0px -10% 0px' });
function watchReveals() {
  document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el, i) => { el.style.setProperty('--i', i % 8); revealObserver.observe(el); });
}
let firstRender = true;
async function render() {
  const path = location.hash.slice(1) || '/';
  if ((path === '/orders') && !state.user) { location.hash = '#/login'; return; }
  const [title, view] = ROUTES[path] || ['Not found – Fieldnote Goods', () => h('section', { class: 'page narrow' }, h('h1', { text: 'Page not found' }), h('a', { class: 'btn btn--primary', href: '#/', text: 'Back to the shop' }))];
  const main = $('#main');
  document.documentElement.classList.remove('is-loaded');
  main.replaceChildren(view());
  document.title = title;
  main.querySelectorAll('[data-split]').forEach(splitWords);
  watchReveals();
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-loaded')));
  document.querySelectorAll('[data-route]').forEach((a) => (a.dataset.route === path ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (!firstRender) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  firstRender = false;
  renderChrome();
}

// ---------- wiring ----------
const drawer = $('#cart');
$('#cart-btn').addEventListener('click', () => { renderDrawer(); drawer.showModal(); });
$('#cart-close').addEventListener('click', () => drawer.close());
$('#to-checkout').addEventListener('click', () => drawer.close());
drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); }); // click on the backdrop
$('#logout-btn').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* cookie may already be gone */ }
  target.clear(); state.checkoutKey = null;
  await load().catch(() => {});
  location.hash = '#/';
  render();
});
addEventListener('hashchange', render);
addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', scrollY > 8), { passive: true });

try { await load(); } catch (e) { toast(describe(e)); }
await render();
