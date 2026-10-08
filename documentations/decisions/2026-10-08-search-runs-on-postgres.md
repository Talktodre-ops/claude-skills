# Search runs on Postgres

Date: 2026-10-08. Status: accepted. Source: Dre: "we will need to make sure
that our postgres attend to our searches... check everywhere the opensearch
works that if we remove it, the app breaks."

## Decision

- Every search (marketplace, directory, lookups, admin lists) is answered by
  Postgres. `SEARCH_BACKEND` defaults to `database`; sync into OpenSearch is
  off with it.
- Free text: every word must match some field, substring match on all fields,
  plus trigram near-miss on short fields at word similarity 0.4 (`pg_trgm`).
- The OpenSearch domain is deleted. The OpenSearch code comes out of the
  backend in its own PR.
- Natural-language search, when built, turns a sentence into filter chips over
  the same Postgres queries.

## Why

The cluster was a second copy of data we already hold, about $58 a month, kept
in sync by signals that missed saves made inside transactions. At our size,
Postgres answers in the same time with nothing to keep in sync. Before the
domain went, a live comparison against both engines matched on every filter.
Free-text differences were by design. The comparison also caught one bug,
`bedrooms_min`, which was fixed before the switch.

We read far more than we write. That argues for Postgres indexes on what
searches read (trigram GIN on the searched text), not for a second engine.

## Rejected

- Keeping OpenSearch as primary with Postgres as fallback: pays for the cluster
  and keeps the sync problem.
- Trigram threshold 0.6 (the default): measured on our data, it missed
  "nigria".

## Revisit when

Listing counts or query patterns make Postgres search slow with indexes in
place, or relevance ranking needs something full-text search cannot give.
Related: [[2026-09-22-the-suite-never-touches-the-search-cluster]],
[[2026-10-08-production-runs-on-two-graviton-hosts]]
