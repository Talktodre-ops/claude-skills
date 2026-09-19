---
name: latency-tracing
description: How to find out where a slow API request actually spends its time, distilled from an investigation on a Django/DRF app whose dashboard was timing out. Covers the measurement ladder (the floor, the count, execution versus distance, behaviour under a burst), wiring OpenTelemetry and Jaeger v2 into a forking WSGI server without getting the two halves backwards, reading a waterfall for the four things worth looking for, and the fixes each finding implies: removing no-op round trips, caching a hot read without letting new data wait behind it, collapsing an N+1, and the worker model. Includes the evidence needed before reaching for an index or a search cluster, and the traps that make a developer misattribute the cost. Load when an endpoint is slow, when instrumenting a service for latency work, or when deciding whether a database change is justified.
---

# Finding where the time goes

A slow request is not a mystery, it is an unmeasured sum. This skill is the
order in which to measure it, the way to wire the instrument, and the small set
of fixes that findings tend to imply.

The running example is a Django/DRF API on gunicorn with Postgres across the
Atlantic, where a dashboard timed out at ten seconds while the server answered
every call with a 200. Nothing was broken. Everything was slow, which is
harder.

## 1. Measure the floor first

Before looking at any endpoint, find out what one round trip to the database
costs from where the code runs, with no application in the way.

```python
with connection.cursor() as c:
    c.execute("SELECT 1")     # warm connection: the floor
connections["default"].close()
with connection.cursor() as c:
    c.execute("SELECT 1")     # cold: connection setup, usually much worse
```

Two numbers come out of this and both matter. In the example they were 300 ms
warm and 2.8 to 5.4 seconds cold. Once you know the floor, every later
measurement divides cleanly: a request that made nine queries and took three
seconds has no mystery in it at all.

Skipping this step is what makes people optimise the wrong thing. A query that
takes 300 ms looks slow until you learn that *nothing* takes less than 300 ms.

## 2. Separate execution from distance

For the handful of statements the hot path leans on, ask the database how long
it spent, and compare with how long the application waited.

```python
cursor.execute("EXPLAIN (ANALYZE, FORMAT JSON) " + sql, params)
plan[0]["Execution Time"]   # milliseconds the database actually spent
```

This is the number that decides whether an index or a different datastore is
even relevant:

- **Execution is milliseconds or less, wall time is hundreds.** The cost is
  distance and count. Indexes remove execution time you do not have. Adding
  one proves nothing.
- **Execution itself is slow.** Now indexing, query shape and plan are the
  subject, and `EXPLAIN (ANALYZE, BUFFERS)` is the tool.

Two cautions. A sequential scan on a small table is not a missing index, it is
the planner being right, so do not read plan node names as verdicts on a dev
dataset. And production-sized data is the only honest trigger for indexing
work; what dev data can tell you is whether the shapes you filter and sort by
have covering indexes ready for when volume arrives.

## 3. Count the round trips, from a trace

Reading code to count queries is unreliable: middleware, signals, auth
backends, serializers and connection bookkeeping all add statements nobody
wrote at the call site. Instrument instead, then read.

### Wiring OpenTelemetry into a forking server

This is where an evening goes if the two halves are the wrong way round.

**Instrument in the master. Export in the worker.**

The Django instrumentation works by inserting its own middleware into
`settings.MIDDLEWARE`. Django freezes that chain when the WSGI handler is
built, so instrumenting has to happen *before* the handler exists. With
`--preload`, the handler is built in the master, so the instrumenting belongs
there.

The exporter ships spans on a background thread, and **a thread does not
survive `fork()`**. A provider created in the master leaves every worker
holding an exporter whose thread is dead: spans are collected and silently
never sent.

```python
# core/wsgi.py - before the handler exists
from core.tracing import instrument_libraries
instrument_libraries()
application = get_wsgi_application()

# gunicorn.conf.py - after the fork, once per worker
def post_fork(server, worker):
    from core.tracing import start_exporter
    start_exporter()
```

`opentelemetry-instrument gunicorn ...`, the documented one-liner, gets both
halves wrong at once.

The two failure modes look nothing like a wiring problem, which is what makes
them expensive:

| symptom | cause |
|---|---|
| Every database query is its own parentless trace, no request spans anywhere | Instrumented after the middleware chain was frozen |
| Spans are created, nothing reaches the collector, no errors | Provider built before the fork |

Keep it off by default and behind one variable (`HEIMLY_TRACING=1`), make
every failure inside it a warning rather than an exception, and hold traces in
memory so nothing is persisted.

### What to instrument

Django, the database driver, redis, the HTTP client, and the task queue. The
database driver is the one that pays for itself immediately, and psycopg2
strips parameters out of statements before they reach a span, so traces show
the shape of a query and never anybody's data.

## 4. Read the waterfall for four things

A trace answers more than "what was slow". Ask it these, in order:

1. **What share of the request is inside a child span?** Time not covered by
   any span is time in your own code, in a library nobody instrumented, or
   before the framework started. In the example, a request showing 2.1 seconds
   uncovered turned out to be connection setup, which the very next span
   confirmed: a `SET TimeZone` is what a brand new connection looks like.
2. **What does the request repeat?** Group a single request's statements by
   shape and look for counts above one. Repeats inside one request are the
   caching and `select_related` candidates. This is how an N+1 announces
   itself without anybody reading the view.
3. **What does every request pay regardless of endpoint?** Connection health
   checks, session variables, auth lookups, flag loads. This is the tax, and
   it is usually invisible in code review because no endpoint asks for it.
4. **What happens under a burst?** Measure the same call alone and inside a
   real page load. In the example, statements averaging 300 ms sequentially
   averaged 3 seconds inside a burst of twenty-three calls, because they all
   contend for one link and one small database. Fewer queries per request
   helps twice over: the request is shorter, and it stops inflating everyone
   else's.

## 5. The fixes findings imply

### Bookkeeping that does nothing

The single best return in the example. A middleware wrote a session variable
on the way in and again on the way out, whether or not the value changed. On
an anonymous request it wrote an empty string over an empty string, twice, and
each write is a full round trip. A liveness probe that touches nothing cost
4.4 seconds.

The fix is to remember what the connection already holds and speak only on a
change, resetting that memory when a connection is created, since a new
session starts clean.

```python
def _write(value: str) -> None:
    if getattr(connection, TRACKED, None) == value:
        return                       # already pinned to this; say nothing
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.current_user_id', %s, false)", [value])
    setattr(connection, TRACKED, value)

@receiver(connection_created)
def _new_connection_starts_empty(sender, connection, **kwargs):
    setattr(connection, TRACKED, "")
```

Prove the semantics did not move, rather than asserting it: set, clear,
repeat-set, repeat-clear and switch, each checked against
`current_setting(...)` and against the number of statements issued.

### A hot read, cached without making new data wait

When one row is read on every request, cache it. The discipline that makes
this safe is one sentence: **a change to the thing must never wait for the
cache.**

- Invalidate on write, through signals, so the next request re-reads.
- Keep a short ttl as the bound on paths a signal cannot see: bulk
  `queryset.update()`, raw SQL, a migration.
- Cache the *read*, not the decision. Every authorisation check should still
  run, on every request, against whatever came back.
- Repeat any check the library did for you, against the cached row, so a hit
  and a miss cannot disagree about who is allowed in.
- Give it an off switch that does not need a deploy.

```python
user = get_cached_user(user_id)
if user is None:
    user = super().get_user(validated_token)   # the library's own checks
    cache_user(user)
    return user
# cache hit: repeat the two checks the library would have made
if api_settings.CHECK_USER_IS_ACTIVE and not user.is_active:
    raise AuthenticationFailed(...)
```

Then test the invalidation, not just the speed: save the row, assert the entry
is gone, assert the next call re-read it and saw the new value.

### The worker model

If the client fires twenty-plus calls at once and the server runs four
synchronous workers, requests queue four at a time and the tail waits for
everything ahead of it. For work that is almost entirely waiting on I/O,
threaded workers turn four slots into dozens. Two caveats worth stating
before changing it: it changes production concurrency, and each thread holds
its own database connection, which against a remote database means more
connection setups, each of which is expensive.

## 6. Honest measurement hygiene

- **Measure the same thing twice, minutes apart.** A link that gave 282 ms
  gave 2,850 ms an hour later and 282 ms again after that. Compare structure,
  query counts and span shapes, not milliseconds across sessions.
- **The first request after a restart is not a measurement.** Connection
  setup, cold caches and per-thread connections all land on it.
- **Do not measure the fix with the harness that cannot see it.** A cached JWT
  path will not show up in a test client that authenticates by session.
- **Prefer counts to timings when reporting.** "The user row is read once per
  request instead of on every request" survives a bad network evening.
  "It went from 448 ms to 0" does not.

## 7. Before reaching for an index or a search cluster

Have these three things, in writing:

1. Execution time from `EXPLAIN (ANALYZE)` on production-sized data, showing
   the database itself is the cost.
2. The query shape that is slow, and the plan node that makes it slow.
3. What the new thing costs: index maintenance on every write, or a second
   source of truth with a sync lag and its own failure modes.

Without the first, the honest answer is usually that the request makes too
many round trips, and no amount of indexing changes a number that is already
zero.
