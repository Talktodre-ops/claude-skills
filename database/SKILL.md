---
name: database
description: Production-grade PostgreSQL for an app backend, distilled from a real multi-tenant SaaS on Neon. Covers connection pooling that does not exhaust the server (pooled endpoint, capped app pools, the pool-times-processes math, PgBouncer transaction-mode rules), indexing the hot paths (foreign keys, composite order, functional and partial indexes, verifying with EXPLAIN, CONCURRENTLY on live tables), Postgres-native search instead of a separate cluster (pg_trgm for fuzzy/substring, native FTS, pg_search/BM25 as the Elasticsearch-in-Postgres option, pgvector for semantic), idempotent and retry-safe writes (unique keys, the claim pattern that eliminates a check-then-act race for exactly-once, dedup, exponential backoff with jitter, append-only ledgers for money), and migration discipline. Load when configuring a DB connection, writing or reviewing queries and migrations, adding search, diagnosing "too many connections" or slow reads, handling a race condition or concurrent writers, or making a write safe to retry.
---

# Production-grade PostgreSQL

Most database pain in a young app is self-inflicted and cheap to prevent: a pool sized
larger than the server allows, a query that sequential-scans because nothing indexes
it, a search that reaches for Elasticsearch when Postgres already does the job, and a
write that double-charges on a retry. Fix these before traffic, not after an incident.

This is the method. Pair it with a project-guide skill for the exact migration runner
and test commands, and a house-rules skill for voice and commits. Fetch version-specific
API details (SQLAlchemy, asyncpg, a specific extension) from current docs, not memory.

## Connections: the first thing that falls over

The classic outage is "too many connections" / "sorry, too many clients", and it is
almost always the app asking for more than the server allows.

The math that matters: **max connections held = (pool_size + max_overflow) x processes**.
A backend, a worker, and a scheduler are three processes. A pool of `pool_size=20,
max_overflow=30` is 50 each, 150 total, which overruns a small managed Postgres. The
fix is a small pool, not a bigger server.

- **Use the pooled endpoint.** Managed Postgres (Neon, Supabase, RDS Proxy) offers a
  PgBouncer endpoint that multiplexes many client connections onto few server ones. Point
  `DATABASE_URL` at it. Then the app pool only needs a handful of connections; PgBouncer
  does the real pooling.
- **Cap the app pool and make it env-driven.** Start at `pool_size=5, max_overflow=5`
  per process and raise deliberately if a resized compute allows it. Keep the total
  comfortably under the server limit (check `show max_connections`).
- **PgBouncer transaction mode forbids server-side prepared statements.** With asyncpg
  that means `statement_cache_size=0`; without it you get random "prepared statement
  does not exist" errors under the pooler.
- **`pool_pre_ping=True`** so a connection the server already closed is discarded and
  retried, not raised to the user. **`pool_recycle`** below the server idle timeout so
  the pool refreshes before the server drops connections.
- **Short-lived workers (Celery tasks) that run their own event loop per task**: give
  each a `NullPool` engine created inside the loop and disposed in a `finally`. Do not
  share a pooled async engine across `asyncio.run` calls; an engine is bound to the loop
  it was created on and fails on the next one. NullPool opens and closes per use, which
  under PgBouncer is cheap.
- **Diagnose with the server, not guesses.** `select count(*), application_name from
  pg_stat_activity group by application_name` shows who holds connections; set a distinct
  `application_name` per service so you can tell them apart.

## Indexing: match the query, not the column

An index earns its write cost only if a real query uses it. Read the query, then index
for it, then confirm with `EXPLAIN`.

- **Index the foreign keys you filter or join on.** An unindexed FK used in a `WHERE`
  is a sequential scan on every lookup. The ORM does not add these for you.
- **Composite order follows the query.** An index on `(a, b)` serves `WHERE a` and
  `WHERE a AND b`, not `WHERE b` alone. Put the equality/most-selective column first.
- **Functional indexes for expressions.** If the query filters `lower(email)`, a plain
  index on `email` is useless; index `lower(email)`. The expression must be IMMUTABLE:
  `lower()`, `||`, and `coalesce()` qualify; `concat()` does not (it is STABLE), so use
  `coalesce(a,'') || ' ' || coalesce(b,'')` for a searchable full name. The index
  expression must match the query expression.
- **Partial indexes for hot subsets.** A sweep that repeatedly reads only the in-flight
  rows (`WHERE status = 'pending'`) wants a partial index `... WHERE status = 'pending'`:
  it indexes a handful of rows, stays tiny, and the planner uses it for exactly that scan.
- **Verify.** `EXPLAIN` the real query. On a small dev table the planner may still
  seq-scan because it is cheaper; `set enable_seqscan = off` for the session to confirm
  the index is usable, and trust it will be used once the table grows.
- **Do not over-index.** Every index slows writes and costs storage. Index the paths
  that run often or scan large tables, not every column.
- **On a large, live table, build with `CREATE INDEX CONCURRENTLY`** so it does not hold
  a write lock. It cannot run inside a transaction, so it does not belong in a normal
  transactional migration; run it as its own step. On small or new tables a plain
  `CREATE INDEX` in the migration is fine.

## Search: reach for Postgres before Elasticsearch

A separate search cluster is a big operational commitment. Postgres covers most needs
in-database. Pick by the need, check the extension is available on your host first
(managed Postgres allows a curated set), and adopt deliberately.

- **Substring / fuzzy (name, email, "contains"): `pg_trgm` + a GIN trigram index.** A
  leading-wildcard `LIKE '%term%'` cannot use a b-tree and sequential-scans; a
  `gin (lower(col) gin_trgm_ops)` index makes it a bitmap index scan. This is the right,
  cheap tool for list-search boxes. It also powers typo-tolerant matching via similarity.
- **Full-text over documents (descriptions, notes): native `tsvector`/`tsquery`** with a
  GIN index, or **`pg_search` (ParadeDB's BM25)** when you want Elasticsearch-grade
  relevance ranking inside Postgres. BM25 is the "new extension that acts like
  Elasticsearch" people remember; it is real and strong, and heavier than trigram, so use
  it when ranked full-text is the actual need (searching JD text, resumes), not for a
  name box.
- **Semantic / similarity ("find people like this"): `pgvector`.** Store embeddings,
  index with HNSW or IVFFlat, query by cosine distance. Pairs naturally with an app that
  already calls an LLM.
- **The trap:** do not stand up Elasticsearch for what a trigram index solves in a
  migration. Do not brute-force full-text ranking with `LIKE` and `ORDER BY count(...)`.

## Writes: idempotent, retry-safe, deduped

Anything that can be retried (a queued task, a webhook, a client re-submitting after a
dropped response) will be. Design writes so a repeat is harmless.

- **Idempotency key or natural-key dedup.** A public "submit application" endpoint
  dedups on `(job_posting_id, lower(email))` and returns the existing row instead of
  creating a second (which would also duplicate downstream work and spend). A payment or
  message carries a client-supplied idempotency key.
- **Exactly-once across concurrent workers: the claim pattern.** When two deliverers (a
  webhook and a polling sweep) can both finish the same job, do not "check then act" (a
  race). Claim atomically: `UPDATE ... SET status='ready', ... WHERE id=:id AND status <>
  'ready'` and act only if `rowcount == 1`. Exactly one caller wins and runs the
  finalize (create the interview, send the email); the loser no-ops.
- **Retry-safe tasks guard on state.** At the top of the task: if the work is already
  done, return; if it is already in flight, let the in-flight path finish rather than
  starting a duplicate. A `max_retries` retry then costs nothing.
- **Retry with exponential backoff and jitter, never a tight loop.** A failed external
  call (LLM, payment, another service) retries after `base * 2**attempt` seconds, capped
  at a ceiling, plus random jitter so a fleet does not retry in lockstep and stampede the
  dependency. Retry only idempotent operations (see above) and only transient failures
  (timeouts, 5xx, rate limits), not a 4xx that will fail again. Give up after a bounded
  number of attempts and record the failure rather than retrying forever.
- **Side effects never break the transaction, and never double-fire.** Queue the email
  and the notification best-effort (wrapped, logged on failure), so a mail outage does
  not roll back the write. Dedup them (a `dedupe_key` on notifications) so a retry does
  not double-notify. Keep the side effect on the single claimed path so it fires once.
- **Money is an append-only ledger with a unique constraint.** Never mutate a balance
  in place. Insert a ledger row with a unique key (e.g. `(session_id, entry_type)`) so a
  double-charge is a duplicate-key no-op, and derive the balance from the ledger. Never
  use floating point for money; use integer minor units.
- **Keep transactions short.** Do not hold a transaction open across an LLM call or an
  HTTP request. Do the slow thing, then open a short transaction to write the result.

## Migrations

- Forward-only and reversible: every migration has a real `downgrade`. Small and
  single-purpose, so a bad one is easy to revert.
- Apply before (or at) deploy, never let the app create schema at runtime.
- Functional and partial indexes, and extension creation, go through raw SQL in the
  migration (autogenerate cannot express them). `CREATE EXTENSION IF NOT EXISTS ...` and
  `CREATE INDEX IF NOT EXISTS ...` are safe to re-run.
- Revision ids and names stay within your tool's limits; confirm the new head after
  applying.

## A short checklist before you call the DB production-ready

- [ ] `DATABASE_URL` points at the pooled endpoint; app pool is small and env-driven;
      `(pool_size + overflow) x processes` is well under `max_connections`.
- [ ] Every foreign key used in a filter or join is indexed; hot expression filters have
      functional indexes; hot subsets have partial indexes; plans confirmed with EXPLAIN.
- [ ] List-search boxes use `pg_trgm`, not `LIKE '%...%'` on an unindexed column.
- [ ] Every retryable write is idempotent (dedup key or the claim pattern); money is an
      append-only ledger with a unique constraint.
- [ ] Side effects are best-effort and deduped, outside the critical transaction.
- [ ] `statement_timeout` set so a runaway query cannot pin a connection forever.
- [ ] Migrations are reversible, applied before deploy, and the new head is confirmed.
