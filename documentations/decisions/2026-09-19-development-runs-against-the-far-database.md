# Development runs against the far database on purpose

Date: 2026-09-19. Status: accepted. Source: Dre, during the API latency
investigation.

## Decision

Local development keeps pointing at the managed development database in AWS
us-east-1, not at a Postgres container on the machine, even though every query
then costs about 300 ms instead of under a millisecond.

The point is that production-shaped latency shows up on a developer's laptop,
where a wasted round trip is cheap to find and cheap to remove, rather than in
production where it is neither. A local database would make the API look fast
and move these findings to a customer's phone on a slow network.

The exception is the test suite. `/usr/local/bin/runtests` inside the api
container points pytest at the compose `postgres-test` service, because a
suite that pays 300 ms per statement takes hours instead of minutes, and a
test suite is not measuring latency.

## How it is built

- `DB_HOST` stays on the remote endpoint for the api and celery containers.
- `runtests` overrides the database variables for pytest only.
- Tracing is available on demand to read the cost when something is slow
  (see the tracing decision of the same date).

## Consequences

The local dashboard is slower than production, and that is the intended
signal, not a defect to work around. The first request after a restart pays
connection setup of two to five seconds, so the first measurement after a
restart is never a measurement. Absolute timings move with the link, so
comparisons are made on query counts and span shapes rather than on
milliseconds between sessions.

Anyone proposing a local Postgres for development should read the latency
investigation in `.agents/api-latency-investigation.md` first: the four
seconds it removed were only visible because the database was far away.

## Supersedes

Nothing.
