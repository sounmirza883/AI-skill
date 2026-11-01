# Choosing How Updates Reach the Client

Rule: **use the cheapest mechanism that meets the freshness the user actually needs, per feature.** Most
features need no realtime at all. Never add WebSockets "just in case".

## 1. Decide per feature

Ask for each screen/feature: *How stale can this be before it hurts?* and *Who changes it — this user or others?*

| Need | Use | Why |
|---|---|---|
| Only this user changes it | **Return new state from the mutation** | No extra request at all |
| Others change it; stale for minutes is fine | **Fetch on load + refetch on window focus / reconnect** | Zero idle traffic |
| Must be ≤ N seconds fresh (N ≥ ~15s), few clients, simple hosting | **Short polling** every N s with `ETag` → `304` | Simple, cacheable, works everywhere |
| Near-instant, server → client, events are rare, SSE not possible (old proxies, some serverless) | **Long polling** | One held request per client, returns on change |
| Near-instant, server → client, frequent (notifications, live dashboards, job progress, AI streaming) | **SSE** (Server-Sent Events) | Plain HTTP, auto-reconnect with `Last-Event-ID`, one connection carries all event types |
| Bidirectional, low latency (chat with typing, collaborative editing, live cursors, games) | **WebSockets** | Full duplex; heavier to run and secure |
| Another server must be told (payment, shipping, ERP) | **Webhooks** (outgoing or incoming) | Server-to-server push; sign + retry + idempotency |
| Database change must trigger something in the backend | **Outbox + worker**, or DB change feed (Postgres `LISTEN/NOTIFY`, logical replication/CDC, Mongo change streams) | Decouples the write from the fan-out |
| Mobile app in background | **Push notifications** (APNs/FCM) | Sockets don't survive backgrounding |

Using Supabase/Firebase? Their realtime listeners are the push mechanism — still subscribe only where a feature is live,
and make sure security rules / RLS apply to realtime too.

## 2. Load math (put it in the design doc)

| Mechanism | Steady load for C clients |
|---|---|
| Refetch on focus | ≈ 0 req/s idle |
| Short polling every T seconds | C ÷ T req/s — **even when nothing changed** |
| Long polling (hold H s) | ≈ C ÷ H req/s idle + 1 request per event per client; C held connections |
| SSE / WebSocket | C open connections, ~0 req/s idle; heartbeat every 25–30s |

Example: 1,000 open tabs polling every 5s = **200 req/s of mostly empty responses**. The same with SSE = 1,000 idle
connections and only real events. With refetch-on-focus = near zero.

## 3. Rules per mechanism

**Short polling**
- Interval = the freshness the feature needs (often 30–60s), plus 10% random jitter.
- Pause when the tab is hidden (`document.hidden`); back off on errors (×2 up to 5 min).
- Send `If-None-Match`; server returns `304` with no body when unchanged.
- Poll one small "what changed" endpoint, not full lists.

```js
let etag, delay = 30_000;
async function poll() {
  try {
    if (!document.hidden) {
      const res = await fetch('/api/orders/status', { headers: etag ? { 'If-None-Match': etag } : {} });
      if (res.status === 200) { etag = res.headers.get('ETag'); render(await res.json()); }
      delay = 30_000;
    }
  } catch {
    delay = Math.min(delay * 2, 300_000); // back off while the server or network is down
  }
  setTimeout(poll, delay + Math.random() * 3_000);
}
poll();
```

**Long polling**
- Client sends its last cursor/version; server holds up to ~25s (below proxy and load-balancer idle timeouts), returns
  immediately on change or with `204` on timeout; client re-requests at once.
- Needs a pub/sub signal between app instances (Redis, Postgres `NOTIFY`) so any instance can wake the waiting request.

**SSE**
- One connection per client for *all* live features; event types distinguish them (`event: stock.updated`).
- Authenticate with the session cookie; filter events per user/tenant on the server — never broadcast another tenant's data.
- Send `id:` on each event so reconnects resume via `Last-Event-ID`; heartbeat comment every ~25s.
- Disable proxy buffering (`X-Accel-Buffering: no` for nginx). Use HTTP/2 (HTTP/1.1 browsers allow only ~6 connections per domain).

```js
// Express example
app.get('/api/events', requireAuth, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (evt) => res.write(`id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt.data)}\n\n`);
  const unsubscribe = bus.subscribe(req.user.tenantId, send); // only this tenant's events
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});
```

```js
// Browser
const events = new EventSource('/api/events', { withCredentials: true });
events.addEventListener('stock.updated', (e) => updateItemInCache(JSON.parse(e.data)));
```

**WebSockets**
- Authenticate during the handshake (cookie or short-lived ticket), check `Origin`, re-check authorization per message.
- Validate and rate-limit every incoming message like an HTTP request; cap message size.
- Plan reconnect + resync (client sends last version; server sends missed changes or a fresh snapshot).

**Webhooks**
- Outgoing: sign payloads (HMAC-SHA256 with a per-receiver secret + timestamp), retry with exponential backoff, include an event ID.
- Incoming: verify the signature and timestamp **before** parsing business logic, respond `2xx` fast and process in a queue, dedupe by event ID.

**Database → backend**
- Postgres `LISTEN/NOTIFY`: simple wake-up signal; payload ≤ 8,000 bytes; **not durable** (missed if nobody listens) — send IDs, re-read the row.
- Durable fan-out: **outbox pattern** — write the business row and an `outbox` row in the same transaction; a worker publishes and marks them sent.
- High-volume / cross-system: CDC (logical replication, Debezium) into a queue.

## 4. Hosting caveats

- **Serverless** (Vercel/Netlify functions, Lambda): long-lived connections are limited or costly → use a managed realtime
  service (Pusher, Ably, Supabase Realtime, Firebase) or a small always-on server just for SSE/WebSocket.
- **Multiple app instances:** connections live on different instances → publish events through Redis pub/sub, Postgres
  `NOTIFY`, or the managed service so every instance can deliver them.

## 5. Worked example — inventory system

| Feature | Freshness needed | Mechanism |
|---|---|---|
| Scanner app: scan → new quantity | instant, own action | Return new state from `POST /stock/movements` |
| Manager dashboard: stock levels, live picking | ≤ 2s | SSE (`stock.updated`, `order.picked`) |
| Low-stock alerts | ≤ 1 min, also when away | SSE in-app + email/push via queue |
| Product catalog, categories | minutes–hours | Fetch on load, cache with `ETag`, refetch on focus |
| Reports / exports | on demand | Background job + "ready" event over SSE (or email link) |
| Supplier portal: PO status | ≤ 5 min | Refetch on focus (suppliers rarely sit on the page) |
| Supplier/ERP sync | minutes | Incoming/outgoing webhooks; nightly reconciliation job |
