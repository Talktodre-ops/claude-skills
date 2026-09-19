# Tracing is on demand, and cached identity never makes new data wait

Date: 2026-09-19. Status: accepted. Source: the API latency investigation.

## Decision

Two rules came out of the same night and belong together, because the first is
how we find this class of problem and the second is the shape of the fix.

**Tracing is available on demand, never on by default.** Jaeger sits beside
the local stack and the API exports spans to it over OTLP when
`HEIMLY_TRACING=1` is set. Traces are held in memory, so a restart clears them
and nothing is written to disk.

**A cache in front of identity must never make new data wait.** Where a hot
read is cached, a change to the thing invalidates it immediately through a
signal; the time to live exists only to bound the paths a signal cannot see.

## How it is built

Tracing, and the part that is easy to get backwards:

- `core/wsgi.py` calls `instrument_libraries()` before
  `get_wsgi_application()`. Django freezes its middleware chain when the
  handler is built and the tracing middleware has to be in it, so under
  `--preload` this has to happen in the gunicorn master. Instrument later and
  there are no request spans at all: every query arrives as its own parentless
  trace.
- `gunicorn.conf.py` calls `start_exporter()` from `post_fork`. The exporter
  ships spans on a background thread and a thread does not survive a fork, so
  a provider built in the master leaves every worker collecting spans that are
  silently never sent.
- `opentelemetry-instrument gunicorn ...`, the documented one-liner, gets both
  halves wrong at once. Do not use it here.
- psycopg2 strips parameters out of statements before they reach a span, so a
  trace shows the shape of a query and never anybody's data.

The cache rule, as applied to the signed-in user in
`account/services/auth_cache.py`:

- Saving a user, deleting one, or changing a role drops that entry through a
  signal. Deactivation and deletion both go through `save()`, so both are
  covered.
- The sixty second ttl bounds only what a signal cannot see: a bulk
  `queryset.update()`, hand-written SQL, a migration.
- Only the read is cached. Every check about who may act still runs on every
  request against whatever came back, and the two checks SimpleJWT makes are
  repeated against the cached row so a hit and a miss cannot disagree.
- `HEIMLY_AUTH_CACHE=0` turns it off without a deploy.
- The feature flag cache already followed this shape and was left alone:
  `post_save`, `post_delete` and both `m2m_changed` signals drop it, so an
  allowlist edit is visible on the next request.

## Consequences

Anyone caching a hot read here is expected to test the invalidation rather
than the speed: save the row, assert the entry is gone, assert the next call
re-read it and saw the new value. A cache that is fast and stale is an outage
with good latency numbers.

Tracing costs nothing when it is off, so the answer to "why is this slow" is
now a command rather than an argument.

## Supersedes

Nothing. It complements the observability stack decision, which covers metrics,
logs and errors in deployed environments; this is request-level latency in
development.
