# Threaded gunicorn workers, measured and proposed, not yet accepted

Date: 2026-09-19. Status: **proposed**. Source: measured during the API
latency investigation; written down at Dre's request so it is not lost as an
undocumented tweak on a running container.

## The proposal

Run gunicorn with threaded workers instead of synchronous ones:

```
--workers 4 --worker-class gthread --threads 8
```

instead of today's `--workers 4 --worker-class sync`, in `supervisord.conf`.

## Why

Four synchronous workers serve exactly four requests at a time. A Heimly
dashboard load fires about twenty-three API calls at once, so nineteen of them
queue, and the last one waits for everything ahead of it. Almost none of that
time is the application thinking: after the round-trip fixes, 99% of a request
is spent inside a database span, which is waiting, not working. Waiting is
what threads are for.

Measured on the development stack, the same cached endpoint went from about
eleven seconds under a page-load burst to about 0.7 seconds sequentially, and
the burst stopped queueing four at a time once the workers had threads.

## Why it is not accepted yet

Three reasons, and none of them is "it did not work":

1. **It changes production concurrency.** Thirty-two slots instead of four
   changes how the service behaves under load, what a slow endpoint does to
   its neighbours, and how quickly the database sees a spike. That deserves a
   load test against pre-prod, not a laptop measurement.
2. **Each thread holds its own database connection.** Four workers times eight
   threads is up to thirty-two connections, each of which costs two to five
   seconds to establish against the remote development database and counts
   against the connection limit in production. More slots is not free.
3. **Django code must be thread safe in practice, not just in theory.** Django
   itself is, and connections are per thread, but any module-level mutable
   state we have added over the years is worth a read before trusting it with
   eight threads per process.

## Its current status in the world, which is the part worth knowing

The change **is live in the running development api container** and **is not
in the repository**. It was applied to `/etc/supervisor/supervisord.conf`
inside the container during the investigation and kept, because it made the
local dashboard usable while the rest of the work happened.

That means: it survives `docker restart`, and it disappears the moment the
container is recreated or the image is rebuilt, at which point the local
dashboard quietly goes back to queueing four at a time. If someone wonders
later why the laptop got slower with no commit to blame, this is the answer.

## What would make it accepted

Either an explicit call from Dre, or a load test on pre-prod showing the
connection count and the tail latency under a realistic burst. Accepting it
means one line in `supervisord.conf` on a branch, with the connection maths
written into the pull request.

## Supersedes

Nothing. It sits alongside the decision that round trips rather than indexes
are the latency lever: fewer queries per request reduces the queue, threads
serve the queue faster, and the two compound.
