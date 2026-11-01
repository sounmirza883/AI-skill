# Call Map & Minimum-Request Design

Goal: know every request in the system, why it exists, what it costs, and remove every one that is not needed.

## 1. Does this need to go through the backend?

| Situation | Through the backend? | How |
|---|---|---|
| Uses a secret (API key, DB password, payment key) | **Yes, always** | Backend calls the third party; the key never reaches the browser |
| Writes shared data (orders, stock, profiles) | **Yes** | Validate + authorize on the server |
| Decides permissions, prices, discounts, totals | **Yes** | Never trust a price or role sent by the client |
| Combines data from several sources | **Yes** | One aggregate endpoint instead of many client calls |
| Static content (marketing pages, docs, images) | **No** | Static hosting / CDN |
| Public read-only data that changes rarely (catalog, settings) | **Mostly no** | Cache at CDN with `Cache-Control: public, max-age=…, stale-while-revalidate=…` |
| File uploads | **Only to sign** | Backend issues a short-lived presigned URL; browser uploads straight to storage; backend validates on completion |
| UI-only state (theme, open tabs, filters) | **No** | Client state / `localStorage` |
| Supabase / Firebase direct client access | **The rules are the backend** | Row-level security / security rules must enforce everything a backend would; audit them like code |
| Server-to-server events (payment succeeded) | **Yes, as a webhook** | Verify signature, process idempotently |

## 2. Build the Call Map

**Find frontend calls** (search the frontend code):

```
fetch(   axios.   ky.   $fetch(   useFetch(   useQuery(   useMutation(   useSWR(
trpc.    graphql`   gql`   supabase.from(   firebase/firestore   new WebSocket(   new EventSource(
"use server" (Next.js server actions)   <form action=
```

**Find backend routes** (by framework):

| Stack | Look for |
|---|---|
| Express / Fastify / Hono | `app.get(` `router.post(` `fastify.route(` `app.use(` |
| Next.js | `app/**/route.ts`, `pages/api/**`, `"use server"` functions, `middleware.ts` |
| NestJS | `@Controller(` `@Get(` `@Post(` guards `@UseGuards(` |
| FastAPI / Flask | `@app.get(` `@router.post(` `@bp.route(` `Depends(` |
| Django / DRF | `urls.py` `path(`, `ViewSet`, `permission_classes` |
| Laravel | `routes/api.php` `Route::`, middleware `auth:sanctum` |
| Rails | `config/routes.rb`, `before_action` |
| Go | `HandleFunc(` `r.GET(` (gin) `e.GET(` (echo) `chi.Router` |
| Spring | `@RestController` `@GetMapping` `SecurityFilterChain` |
| .NET | `[ApiController]` `app.MapGet(` `[Authorize]` |

**Count real database queries per request** (turn on for one run, then off):

| Tool | Setting |
|---|---|
| Prisma | `new PrismaClient({ log: ['query'] })` |
| Drizzle | `drizzle(client, { logger: true })` |
| TypeORM / Sequelize | `logging: true` |
| SQLAlchemy | `create_engine(..., echo=True)` |
| Django | `django-debug-toolbar` or `connection.queries` with `DEBUG=True` |
| Laravel | `DB::listen(...)` or Laravel Debugbar / Telescope |
| Rails | log level debug, `bullet` gem for N+1 |
| PostgreSQL | `pg_stat_statements`, `log_min_duration_statement = 200` |

**Call Map table** (put it in `BACKEND.md`):

| Screen / trigger | Method + route | Handler | DB queries | Auth + owner check | Rate-limit class | Needed? | Fix |
|---|---|---|---|---|---|---|---|
| Stock list / page load | GET /api/items | items.list | 1 + 50 (N+1) | session, ✗ no warehouse check | none | yes | join categories; add warehouse filter; `read` class |
| Stock list / page load | GET /api/categories | categories.list | 1 | none | none | **no** | include in `/api/screens/stock` response, cache 1h |
| Header / every 5s | GET /api/notifications | notif.list | 2 | session | none | **wasteful** | SSE or refetch on focus |

Mark each row: **needed**, **wasteful** (remove, merge or cache), or **unprotected** (missing auth, owner check, limit or pagination).

## 3. Wasteful patterns and their fixes

| Pattern | How to spot it | Fix |
|---|---|---|
| **Waterfall** — call B waits for call A | Sequential `await` in the frontend; network tab staircase | Fetch in parallel, or one aggregate endpoint |
| **Chatty screen** — 5–15 calls per page | Network tab on first load | Screen-shaped endpoint (`GET /api/screens/dashboard`) or BFF; GraphQL if already used |
| **N+1 queries** | Query log shows one query per row | Join / `include` / `IN (...)` / DataLoader |
| **Over-fetching** | Response has fields the UI never reads; `SELECT *` | Select only needed columns; DTO per endpoint |
| **Duplicate calls** | Same URL twice on one page (two components) | Shared query cache (TanStack Query, SWR, RTK Query) with a stable key |
| **Refetch everything after a write** | Mutation followed by a full list reload | Return the updated object from the mutation; update the cache |
| **Tight polling** | `setInterval` 1–5s | See `realtime.md` — usually refetch on focus or SSE |
| **Search on every keystroke** | Request per character | Debounce 250–300ms, min 2 chars, cancel the previous request (`AbortController`) |
| **Unbounded lists** | No `limit` param | Paginate (default 25, max 100) |
| **One-by-one writes** | Loop of POSTs (bulk import, multi-select delete) | Batch endpoint: `POST /api/items/batch` (cap 500 per call), one transaction |
| **Uncached static-ish data** | Same categories/settings fetched on every page | `Cache-Control` + `ETag`; client cache with long `staleTime` |
| **Large payloads** | Responses > 100 KB for lists | Pagination, field selection, compression (gzip/br) |
| **Backend proxying files** | Upload/download streams through the API server | Presigned URLs to object storage / CDN |

## 4. Minimum-request design

**Budgets** (defaults; justify anything above them):

| Thing | Budget |
|---|---|
| Requests per screen on first load | 1–3 |
| Requests per user action (save, scan, click) | 1 |
| DB queries per request | 1–3 (reads), 1 transaction (writes) |
| Requests while idle on a screen | 0 (unless a feature is explicitly live) |
| Response size, list endpoints | < 100 KB |

**Techniques, in order of preference:**

1. **Don't call** — compute on the client, ship data with the page (SSR / server components), or cache at the CDN.
2. **Cache on the client** — query library with sensible `staleTime`; `ETag` / `If-None-Match` → `304 Not Modified` costs almost nothing.
3. **Merge** — one screen-shaped endpoint returns everything the first paint needs.
4. **Batch** — many writes or lookups in one request, one transaction.
5. **Return what changed** — mutations return the updated resource (and related counters) so the client doesn't refetch.
6. **Optimistic UI** — update the screen immediately, roll back on error; feels instant without extra calls.
7. **Push only what is live** — SSE/WebSocket for the few features that truly need it.

**Worked example — inventory "Stock" screen**

Before: `GET /me`, `GET /warehouses`, `GET /categories`, `GET /items?page=1` (+50 N+1 queries), `GET /alerts`, poll `GET /alerts` every 5s.
→ 5 requests + 12 requests/minute idle per open tab; ~55 queries on load.

After:
- `GET /api/screens/stock?warehouse=…&cursor=…` → `{ me, warehouses, categories, items, lowStockCount }` — 1 request, 3 queries, categories cached 1h server-side.
- Low-stock alerts arrive over the one SSE connection the app already keeps for live features, or refetch on focus if not live.
- Scanning an item: `POST /api/stock/movements` returns the new quantity → no list refetch.
→ 1 request on load, 0 while idle, 1 per scan.

## 5. How the request reaches the database (and back)

Name each hop in the design doc and what it does:

```
Browser
  → CDN / edge (cache public GETs, TLS, WAF, IP rate limit, bot protection)
  → Load balancer / API gateway (TLS termination, coarse rate limit, request size limit)
  → App server (auth middleware → validation → per-user rate limit → handler)
      → Service layer (business rules, authorization on the object, transaction)
          → DB via connection pool (parameterized queries, least-privilege DB user)
          → Cache (read-through / invalidate on write)
          → Queue (slow work: emails, exports, third-party sync)
  ← Response (only the fields the client needs, cache headers, no internal errors)
```

**Getting database changes back to the client:** after a write, the same request returns the new state. For changes made
*by someone else*, see `realtime.md` — the server publishes an event (from the write path or an outbox/CDC), and only
clients that need it live receive it.
