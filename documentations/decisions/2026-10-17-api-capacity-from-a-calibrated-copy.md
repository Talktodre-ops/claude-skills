---
date: 2026-10-17
status: accepted
tags: [performance, production, security]
---

# API capacity comes from a calibrated copy, and four changes moved the wall

Date: 2026-10-17. Status: accepted. Source: Dre, after the local load test: "go
ahead with the hasher, caching and keep-alive fixes", then "when ci passes, merge
and deploy to prod".

## Context

An ad campaign could send 8,000 to 10,000 requests a minute. A prod-sized copy on
one machine ([[prod-mimic]] skill), calibrated to production (the copy is about
2x faster), showed two 0.5 vCPU API tasks held about 1,000 requests a minute on
production. API CPU was the only wall: the database stayed under 30% CPU and
PgBouncer never queued.

## Decision

1. Argon2id at OWASP's minimum: 19 MiB, 2 passes, 1 lane (was Django's 100 MiB,
   2, 8). A subclass replaces the stock entry; old hashes rewrite on sign-in.
2. Signed-out marketplace list, featured and search answers shared per query for
   30 s (`MARKETPLACE_ANON_CACHE_SECONDS`); never for signed-in users, logged
   searches or private answers; fails open.
3. gunicorn `--keep-alive 65`, above the ALB's 60 s idle timeout.
4. gunicorn `--max-requests 10000 --max-requests-jitter 1000` (was 1000 / 50).

Result on the copy: clean to 7,000 requests a minute (was 2,000); registration
85 ms (was 780). Estimated about 3,500 a minute on production's two tasks.
Live in production on 2026-10-17 (BE #227, #228).

## Why

Each change targeted a measured cost: hashing was half of all API time at 30
sign-ups a minute and could run a task out of memory; list, featured and search
were 41% of API time and identical for every signed-out visitor; the keep-alive
mismatch matches the 2 to 3 ELB 502s a day; request-counted recycling stalled
workers once requests got cheap.

## Rejected

- More gunicorn threads or a bigger pool: no gain on half a core; threads
  degraded worse past the knee.
- Bigger tasks or more hosts first: possible, but would have paid for waste the
  four changes removed.
- Keeping Argon2 defaults: stronger per guess, but unaffordable on half a core and
  an out-of-memory risk.

## Revisit when

- The campaign date is set: size for 10,000 a minute (about six API tasks; the
  pool of 20 per task was sized for six).
- Tasks get more CPU: re-test threads, and reconsider Argon2's memory.
- Signed-out answers start to differ by viewer (personalisation): the cache key
  must change or the cache must go.
