# Every search read path degrades to Postgres; scoped views opt in explicitly

**Date:** 2026-09-03
**Status:** Accepted
**PRs:** BE-heimly #113

**Context.** After SP3 to SP7, an unreachable cluster turned the marketplace,
directory, location lookups and dashboard lists into 500s. Not hypothetical:
deploying the search platform before the prod index existed took the
marketplace down until the reindex ran, and a date-serialization bug on the
offer list (opensearch-dsl hands DRF a datetime for a date-mapped field)
produced a live "Failed to fetch offers" the next day.

**Decision.** Every read path that queries the index falls back to a
database query when the cluster cannot answer. The rules that decide what a
viewer may see (listability, embargo, ranking order, per-persona org scoping)
are reproduced exactly and held by leak tests; free text degrades from fuzzy
to substring; facets drop. Wrong results are never acceptable degraded
output, fewer results are.

The fallback is opt-in per view, never inferred. The org-scoped views
(offers, applications, maintenance, users) each declare their own scoped ORM
equivalent; a view that declares none answers 503. The maintenance view's own
history is the reason: its scoping fixed a documented bidirectional org leak,
and a generic fallback that guessed at scoping would trade an outage for a
tenant leak.

Latency was half the work. On client defaults the fallback engaged after ~34
seconds, which is an outage with extra steps. A 3-second timeout applied
per-request at the read call sites brings the realistic failure (host
resolves, cluster refuses) to 0.09s. The timeout deliberately does NOT live
on the shared client config: the first attempt put it there and the very next
bulk reindex died at 3 seconds. No transport retries anywhere, because the
database fallback is the better second attempt.

Degradation is loud: exception-level logs plus a SearchFallbacks CloudWatch
metric dimensioned by surface. An alarm on >0 is the follow-up that makes it
real.

**Rejected.** A blanket automatic fallback on the shared viewset (drops org
scoping, reintroduces the leak). Matching a broken-empty primary path for
landlord offer lists rather than the documented intent. Retry-on-timeout
(doubles the wait a fallback exists to eliminate).

**Revisit when.** The scoped views get a shared scope-spec abstraction that
renders to both the Search and the ORM, which would remove the parallel
implementations these leak tests currently hold together.
