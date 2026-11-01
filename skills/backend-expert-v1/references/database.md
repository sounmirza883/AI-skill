# Database Engineering

Goal: every request does the fewest, fastest queries; data stays correct under concurrency; growth and failure are planned.

## 1. Connections

- Always use a **connection pool**. Pool size ≈ busy connections × 2 (see `capacity-and-rate-limits.md`), usually 10–30 per app instance.
- **Serverless:** each function instance opens connections → use a pooler (PgBouncer in transaction mode, Supabase/Neon pooled URL, RDS Proxy, Prisma Accelerate).
- TLS to the database. Database not reachable from the public internet (private network / allowlist).
- **Least-privilege DB users:** `app` (read/write data only, no DDL), `migrator` (DDL, used only by migrations), `readonly` (reports/analytics). Never connect the app as superuser.
- Set `statement_timeout` for the app role (e.g. 5s) and `idle_in_transaction_session_timeout`.

## 2. Queries

- Parameterized queries only.
- Select only the columns you need.
- **Kill N+1:** joins, ORM `include`/`select_related`/`prefetch_related`/`with`, `WHERE id IN (...)`, or DataLoader.
- Aggregate in the database (`COUNT`, `SUM`, `GROUP BY`), not by loading rows into the app.
- Run `EXPLAIN (ANALYZE, BUFFERS)` on every query that touches a large table or runs on a hot path; look for sequential scans on big tables and row-estimate mismatches.

## 3. Indexes

- Index foreign keys and every column used in `WHERE`, `JOIN` and `ORDER BY` on hot paths.
- Composite index order: **equality columns first, then range/sort columns** — e.g. `(tenant_id, warehouse_id, created_at DESC)`.
- Multi-tenant tables: start composite indexes with `tenant_id`.
- Partial indexes for common filters (`WHERE status = 'open'`), unique indexes to enforce business rules (`UNIQUE (warehouse_id, sku)`).
- Don't over-index write-heavy tables; remove unused indexes (`pg_stat_user_indexes.idx_scan = 0`).
- Create indexes on big live tables with `CREATE INDEX CONCURRENTLY` (PostgreSQL).

## 4. Pagination

- Small/admin lists: `LIMIT/OFFSET` is fine.
- Large or hot lists: **keyset (cursor) pagination** — constant speed at any depth:

```sql
SELECT id, sku, name, quantity, created_at
FROM items
WHERE tenant_id = $1 AND (created_at, id) < ($2, $3)   -- cursor from the last row of the previous page
ORDER BY created_at DESC, id DESC
LIMIT 25;
```

Return `nextCursor` to the client; never return total counts on huge tables unless needed (they cost a full scan) — use estimates.

## 5. Transactions & concurrency

- Keep transactions short; **no network calls** (email, payment API, HTTP) inside a transaction.
- Use the default isolation (Read Committed in PostgreSQL) plus explicit techniques below; reach for `SERIALIZABLE` only when needed, with retry.

### Inventory: never read-then-write stock

Wrong: `SELECT quantity` → check in app → `UPDATE quantity = <computed>` (two concurrent requests both pass the check → negative stock).

Right: one atomic conditional update + a ledger row, in one transaction:

```sql
BEGIN;
UPDATE stock
SET quantity = quantity - $1, updated_at = now()
WHERE item_id = $2 AND warehouse_id = $3 AND quantity >= $1
RETURNING quantity;                      -- 0 rows → insufficient stock → ROLLBACK, return 409
INSERT INTO stock_movements (item_id, warehouse_id, delta, reason, user_id, idempotency_key)
VALUES ($2, $3, -$1, $4, $5, $6);        -- append-only history: audit + rebuild source
COMMIT;
```

Add `CHECK (quantity >= 0)` on the column as a last line of defense.

| Technique | Use when |
|---|---|
| Atomic conditional `UPDATE ... WHERE` | Counters, stock, balances, seat/slot booking |
| Optimistic locking (`version` column, `WHERE version = $n`) | Users editing the same record in forms; on conflict return 409 and let them reload |
| `SELECT ... FOR UPDATE` | Multi-row business logic that must see a stable state; lock rows in a consistent order (e.g. by ID) to avoid deadlocks |
| `FOR UPDATE SKIP LOCKED` | Job queues in Postgres, workers picking tasks |
| Unique constraint | "Only one of X" rules — let the database enforce it, catch the violation |

### Idempotency (safe retries)

Clients send `Idempotency-Key: <uuid>` on create/payment/stock requests. Store `(user_id, key) UNIQUE`, the request hash
and the response; a repeat with the same key returns the stored response instead of doing the work twice. Keep keys ~24h.
Scanner apps on flaky Wi-Fi need this — otherwise a retry double-counts stock.

## 6. Caching (only after measuring)

- Order: HTTP caching (`ETag`, `Cache-Control`) → in-process memo for tiny static data → Redis.
- **Cache-aside:** read cache → miss → read DB → set with TTL; on write, delete the key (don't try to update it).
- Cache shared, read-heavy, slow-to-compute data (catalog, settings, dashboard aggregates). Do not cache per-user
  authorization-sensitive data unless the key includes the user/tenant.
- Every cache entry has a TTL; know what happens when the cache is empty (stampede → use a lock or stale-while-revalidate).

## 7. Scaling path (in this order, only when measured)

1. Fix queries and indexes. 2. Add caching. 3. Bigger database instance. 4. Read replicas for heavy reads (beware replica
lag: read your own writes from the primary). 5. Partition huge append-only tables (e.g. `stock_movements` by month).
6. Separate databases per domain. Sharding is almost never the answer for business apps.

## 8. Schema hygiene

- `timestamptz` in UTC; money as integer minor units (cents) or `NUMERIC`, never float.
- `created_at`, `updated_at` on every table; `created_by` / `updated_by` on business tables.
- Foreign keys and `NOT NULL` by default; enums or check constraints for statuses.
- Soft delete (`deleted_at`) only where recovery or history matters — and filter it everywhere (or use a view). Personal-data erasure requests still need real deletion or anonymization.
- Audit table for sensitive changes (who, what, before/after, when).

## 9. Migrations

- Versioned, in git, applied by CI/CD with the `migrator` role — never by hand in production.
- **Expand → migrate → contract:** add new nullable column/table → deploy code that writes both → backfill in batches → switch reads → remove old column in a later release.
- Avoid long locks on big tables: add columns as nullable without volatile defaults, build indexes concurrently, backfill in batches of 1,000–10,000 rows.

## 10. Backups & recovery

- Automated daily backups + point-in-time recovery (PITR); encrypted; stored in a separate account/region.
- Define RPO (how much data you can lose) and RTO (how long you can be down) with the user.
- **Test a restore** at least quarterly — an untested backup is not a backup.

## 11. BaaS (Supabase / Firebase)

- Supabase: enable **RLS on every table**; policies use `auth.uid()` and tenant membership; the `service_role` key never leaves the server.
- Firebase: security rules for every collection; validate field types and ownership in rules; Admin SDK only on the server.
- Treat rules as backend code: review them, and list them in the Test Handoff.
