# Round trips, not indexes, are the latency lever for now

Date: 2026-09-19. Status: accepted. Source: measured during the API latency
investigation, decided with Dre.

## Decision

We are not adding indexes and not moving any read into OpenSearch to fix API
latency. The lever is the number of database round trips a request makes, and
after that the size of what it returns.

The evidence is execution time at the database, from `EXPLAIN (ANALYZE)` on
the six statements the dashboard leans on:

| statement | executes | waits in the app |
|---|---|---|
| user by primary key | 0.1 ms | 280 ms |
| roles for a user | 0.0 ms | 248 ms |
| organizations for a user | 0.1 ms | 271 ms |
| notifications for a user | 0.2 ms | 293 ms |
| properties for an organization | 0.2 ms | 284 ms |
| tenancies for the rent roll | 0.0 ms | 267 ms |

An index removes execution time. There is none to remove. OpenSearch replaces
the store for ranked, fuzzy, multi-field text; these are point lookups by
foreign key, which is what Postgres is best at. Either change would cost
something real, write amplification in one case, a second source of truth and
a sync lag in the other, and buy nothing a user could feel.

## How it is built

- The fixes that followed were removals: a middleware that wrote a session
  variable twice per request whether or not it changed, and a user row re-read
  on every authenticated request.
- OpenSearch keeps the job it already has, property search, which is the shape
  it is for.
- A sequential scan in a dev plan is not treated as a missing index. On a
  small table it is the planner being right.

## Consequences

Performance work here starts by counting round trips in a trace, not by
reading plans. A proposal to index or to add a search cluster needs three
things first: execution time from `EXPLAIN (ANALYZE)` on production-sized
data, the plan node that makes it slow, and what the new thing costs on every
write.

This decision is expected to flip for specific tables as volume grows. The
cheap preparation, which does not wait, is to keep covering indexes on the
shapes we filter and sort by, notifications by user and date, tenancies by
organization, properties by owner, so the plans stay index-driven when the
tables are big enough for it to matter.

## Supersedes

Nothing.
